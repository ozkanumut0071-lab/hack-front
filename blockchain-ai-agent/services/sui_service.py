"""
Sui Blockchain Service - Transaction Building & Execution

Implements interaction with Sui blockchain using pysui SDK.
Handles balance queries, transaction building (PTB), and execution.
"""

import logging
from typing import Optional, Dict, Any

# Configure logger for this module
logger = logging.getLogger(__name__)
from pysui import SuiConfig, SyncClient, SuiAddress
from pysui.sui.sui_types.scalars import ObjectID, SuiString
from pysui.sui.sui_txn import SyncTransaction
from pysui.sui.sui_types.collections import SuiArray

from config import settings
from models.schemas import TokenType, BalanceInfo, TransactionResult, StakeInfo


# Token type identifiers on Sui (Testnet)
# These are the fully qualified type names for different tokens
TOKEN_TYPES = {
    TokenType.SUI: "0x2::sui::SUI",
    TokenType.USDC: "0x2::coin::Coin<0xTODO::usdc::USDC>"  # Replace with actual USDC package
}


class SuiService:
    """
    Sui Blockchain Service for transaction building and execution

    Handles:
    - Balance queries for SUI and other tokens
    - Programmable Transaction Block (PTB) construction
    - Transfer transactions
    - Gas estimation
    """

    def __init__(self):
        logger.info(f"Initializing SuiService with RPC URL: {settings.SUI_RPC_URL}")
        # Initialize Sui client configuration
        self.config = SuiConfig.user_config(
            rpc_url=settings.SUI_RPC_URL
        )
        self.client = SyncClient(self.config)
        logger.info("SuiService initialized successfully")

    async def get_balance(
        self,
        address: str,
        token_type: TokenType = TokenType.SUI
    ) -> BalanceInfo:
        """
        Get token balance for an address

        Args:
            address: Sui wallet address
            token_type: Type of token (SUI, USDC, etc.)

        Returns:
            BalanceInfo with balance in smallest units and formatted

        Raises:
            ValueError: If address is invalid or balance query fails
        """
        logger.info(f"Getting {token_type.value} balance for address: {address}")
        try:
            sui_address = SuiAddress(address)

            if token_type == TokenType.SUI:
                # Get SUI balance
                logger.debug("Fetching SUI gas objects...")
                result = self.client.get_gas(sui_address)

                if result.is_ok():
                    # Sum all gas objects
                    total_balance = sum(
                        int(coin.balance) for coin in result.result_data.data
                    )
                    logger.info(f"SUI balance retrieved: {total_balance} MIST ({len(result.result_data.data)} coin objects)")

                    # SUI has 9 decimals
                    balance_formatted = f"{total_balance / 1_000_000_000:.4f}"

                    return BalanceInfo(
                        token=TokenType.SUI,
                        balance=str(total_balance),
                        balance_formatted=balance_formatted
                    )
                else:
                    logger.error(f"Failed to get SUI balance: {result.result_string}")
                    raise ValueError(f"Failed to get balance: {result.result_string}")

            else:
                # For other tokens, use get_coin method
                coin_type = TOKEN_TYPES.get(token_type)
                if not coin_type:
                    logger.error(f"Unsupported token type: {token_type}")
                    raise ValueError(f"Unsupported token type: {token_type}")

                # Get coin objects of specific type
                logger.debug(f"Fetching {token_type.value} coin objects...")
                result = self.client.get_coin(
                    coin_type=coin_type,
                    address=sui_address
                )

                if result.is_ok():
                    total_balance = sum(
                        int(coin.balance) for coin in result.result_data.data
                    )
                    logger.info(f"{token_type.value} balance retrieved: {total_balance}")

                    # USDC typically has 6 decimals
                    decimals = 6 if token_type == TokenType.USDC else 9
                    balance_formatted = f"{total_balance / (10 ** decimals):.4f}"

                    return BalanceInfo(
                        token=token_type,
                        balance=str(total_balance),
                        balance_formatted=balance_formatted
                    )
                else:
                    logger.error(f"Failed to get {token_type.value} balance: {result.result_string}")
                    raise ValueError(f"Failed to get balance: {result.result_string}")

        except Exception as e:
            logger.error(f"Error getting balance for {address}: {str(e)}", exc_info=True)
            raise ValueError(f"Error getting balance: {str(e)}")

    async def build_transfer_transaction(
        self,
        sender: str,
        recipient: str,
        amount: str,
        token_type: TokenType = TokenType.SUI
    ) -> Dict[str, Any]:
        """
        Build a Programmable Transaction Block (PTB) for token transfer

        PTB is Sui's powerful transaction building system that allows
        composing multiple operations atomically.

        Args:
            sender: Sender's wallet address
            recipient: Recipient's wallet address
            amount: Amount in smallest units (MIST for SUI)
            token_type: Type of token to transfer

        Returns:
            Dictionary with transaction data ready for signing

        Raises:
            ValueError: If transaction building fails
        """
        logger.info(f"Building transfer transaction: {amount} {token_type.value} from {sender} to {recipient}")
        try:
            sender_address = SuiAddress(sender)
            recipient_address = SuiAddress(recipient)
            amount_int = int(amount)
            logger.debug(f"Amount in smallest units: {amount_int}")

            # Create transaction builder
            logger.debug("Creating transaction builder...")
            txn = SyncTransaction(
                client=self.client,
                initial_sender=sender_address
            )

            if token_type == TokenType.SUI:
                # Split coins for exact amount transfer
                # This creates a new coin with exact amount from sender's gas coins
                logger.debug("Splitting SUI coins for transfer...")
                split_coin = txn.split_coin(
                    coin=txn.gas,
                    amounts=[amount_int]
                )

                # Transfer the split coin to recipient
                logger.debug("Adding transfer_objects command...")
                txn.transfer_objects(
                    transfers=[split_coin],
                    recipient=recipient_address
                )

            else:
                # For other tokens, we need to merge/split from token coins
                coin_type = TOKEN_TYPES.get(token_type)
                if not coin_type:
                    logger.error(f"Unsupported token type: {token_type}")
                    raise ValueError(f"Unsupported token type: {token_type}")

                # Get sender's coin objects of this type
                logger.debug(f"Fetching {token_type.value} coin objects...")
                coins_result = self.client.get_coin(
                    coin_type=coin_type,
                    address=sender_address
                )

                if not coins_result.is_ok() or not coins_result.result_data.data:
                    logger.error(f"No {token_type.value} coins available for {sender}")
                    raise ValueError(f"No {token_type} coins available")

                # Take first coin as primary
                primary_coin = ObjectID(coins_result.result_data.data[0].coin_object_id)
                logger.debug(f"Primary coin: {primary_coin}")

                # If there are multiple coins, merge them first
                if len(coins_result.result_data.data) > 1:
                    logger.debug("Merging multiple coins...")
                    merge_coins = [
                        ObjectID(coin.coin_object_id)
                        for coin in coins_result.result_data.data[1:]
                    ]
                    txn.merge_coins(
                        merge_to=primary_coin,
                        merge_from=merge_coins
                    )

                # Split exact amount
                split_coin = txn.split_coin(
                    coin=primary_coin,
                    amounts=[amount_int]
                )

                # Transfer to recipient
                txn.transfer_objects(
                    transfers=[split_coin],
                    recipient=recipient_address
                )

            # Serialize transaction to bytes
            logger.info("Serializing transaction...")
            tx_bytes = txn.serialize()
            logger.info(f"Transaction built successfully, bytes length: {len(tx_bytes)}")

            return {
                "transaction_bytes": tx_bytes,
                "sender": sender,
                "recipient": recipient,
                "amount": amount,
                "token_type": token_type.value
            }

        except Exception as e:
            logger.error(f"Error building transfer transaction: {str(e)}", exc_info=True)
            raise ValueError(f"Error building transfer transaction: {str(e)}")

    async def estimate_gas_fee(
        self,
        transaction_bytes: bytes
    ) -> str:
        """
        Estimate gas fee for a transaction

        Args:
            transaction_bytes: Built transaction bytes

        Returns:
            Estimated gas fee in MIST (smallest SUI unit)

        Note:
            For MVP, we use a simple estimation.
            In production, use dry_run_transaction_block for accurate estimation.
        """
        # Simple estimation: most transfers cost ~1-5M MIST (0.001-0.005 SUI)
        # In production, use: self.client.dry_run_transaction_block()
        estimated_gas = "2000000"  # ~0.002 SUI
        return estimated_gas

    async def execute_transaction(
        self,
        transaction_bytes: bytes,
        signature: str
    ) -> TransactionResult:
        """
        Execute a signed transaction on Sui blockchain

        Args:
            transaction_bytes: Built transaction bytes
            signature: User's signature from wallet

        Returns:
            TransactionResult with digest and effects

        Raises:
            ValueError: If execution fails
        """
        try:
            # Execute transaction with signature
            # Note: This is a simplified version for MVP
            # In production, you'd use wallet integration for signing

            result = self.client.execute_transaction_block(
                tx_bytes=transaction_bytes,
                signatures=[signature]
            )

            if result.is_ok():
                return TransactionResult(
                    success=True,
                    transaction_digest=result.result_data.digest,
                    effects=result.result_data.effects
                )
            else:
                return TransactionResult(
                    success=False,
                    error=result.result_string
                )

        except Exception as e:
            return TransactionResult(
                success=False,
                error=f"Transaction execution failed: {str(e)}"
            )

    async def get_transaction_status(self, digest: str) -> Dict[str, Any]:
        """
        Get status and details of a transaction by digest

        Args:
            digest: Transaction digest

        Returns:
            Dictionary with transaction status and effects
        """
        try:
            result = self.client.get_transaction_block(digest)

            if result.is_ok():
                return {
                    "digest": digest,
                    "status": "success" if result.result_data.effects.status.status == "success" else "failed",
                    "effects": result.result_data.effects,
                    "timestamp": result.result_data.timestamp_ms
                }
            else:
                raise ValueError(f"Failed to get transaction: {result.result_string}")

        except Exception as e:
            raise ValueError(f"Error getting transaction status: {str(e)}")

    async def get_user_stake(
        self,
        user_address: str,
        token_type: TokenType = TokenType.SUI
    ) -> StakeInfo:
        """
        Get user's staked amount from the staking pool

        NOTE: This is a simplified version that returns 0.
        To get actual stake info, you need to query the blockchain directly
        or implement proper devInspect functionality.

        Args:
            user_address: User's wallet address
            token_type: Token type (currently only SUI is supported)

        Returns:
            StakeInfo with staked amount (currently always 0)
        """
        logger.info(f"Getting stake info for user: {user_address}")
        logger.warning("get_user_stake is simplified - returning 0. Implement proper devInspect for accurate results.")

        # TODO: Implement proper devInspect call when pysui API is updated
        # For now, return 0
        return StakeInfo(
            user_address=user_address,
            staked_amount="0",
            staked_amount_formatted="0.0000",
            token=TokenType.SUI
        )

    def get_stake_pool_id(self) -> Optional[str]:
        """
        Discover the StakePool shared object ID by querying the chain.
        The StakePool is created during module init and is a shared object.
        
        Returns:
            StakePool object ID or None if not found
        """
        try:
            # If configured in settings, use that
            if settings.STAKE_POOL_OBJECT_ID and settings.STAKE_POOL_OBJECT_ID != "":
                return settings.STAKE_POOL_OBJECT_ID
            
            logger.info("Discovering StakePool object...")
            
            import httpx
            
            # Query for package initialization transaction to find created objects
            # The StakePool is a shared object created by the init function
            stake_pool_type = f"{settings.STAKE_PACKAGE_ID}::{settings.STAKE_MODULE}::StakePool"
            
            # Use suix_queryEvents to find the package publish transaction
            # Then get the created objects from it
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "suix_queryEvents",
                "params": [
                    {
                        "MoveModule": {
                            "package": settings.STAKE_PACKAGE_ID,
                            "module": settings.STAKE_MODULE
                        }
                    },
                    None,
                    1,
                    False
                ]
            }
            
            response = httpx.post(settings.SUI_RPC_URL, json=payload, timeout=10.0)
            result = response.json()
            
            # If we can find an event, we can trace back to the StakePool
            # For now, return None and require manual configuration
            logger.info(f"StakePool discovery result: {result}")
            
            # TODO: Implement full discovery logic
            # For now, return None - user needs to configure STAKE_POOL_OBJECT_ID
            return None
            
        except Exception as e:
            logger.error(f"Error discovering StakePool: {str(e)}", exc_info=True)
            return None

    def build_stake_tx(
        self,
        sender: str,
        amount: str,
        stake_pool_id: str,
        token_type: TokenType = TokenType.SUI
    ) -> Dict[str, Any]:
        """
        Build transaction metadata to stake SUI tokens.
        Returns metadata for frontend to build and sign the transaction.

        Args:
            sender: Sender's wallet address
            amount: Amount in smallest units (MIST for SUI)
            stake_pool_id: The StakePool shared object ID
            token_type: Token type (currently only SUI is supported)

        Returns:
            Dictionary with transaction metadata for frontend signing
        """
        try:
            logger.info(f"Building stake transaction: {amount} MIST for {sender}")

            target = f"{settings.STAKE_PACKAGE_ID}::{settings.STAKE_MODULE}::stake"

            logger.info(f"Stake transaction metadata built for target: {target}")

            return {
                "success": True,
                "transaction_type": "stake",
                "target": target,
                "stake_pool_id": stake_pool_id,
                "amount": int(amount),
                "sender": sender,
                "action": "stake",
                "message": f"Transaction ready. Sign with your wallet to stake {int(amount)/1_000_000_000:.4f} SUI."
            }

        except Exception as e:
            logger.error(f"Error building stake transaction: {str(e)}", exc_info=True)
            raise ValueError(f"Error building stake transaction: {str(e)}")

    def build_unstake_tx(
        self,
        sender: str,
        amount: str,
        stake_pool_id: str,
        token_type: TokenType = TokenType.SUI
    ) -> Dict[str, Any]:
        """
        Build transaction metadata to unstake SUI tokens.
        Returns metadata for frontend to build and sign the transaction.

        Args:
            sender: Sender's wallet address
            amount: Amount in smallest units (MIST for SUI)
            stake_pool_id: The StakePool shared object ID
            token_type: Token type (currently only SUI is supported)

        Returns:
            Dictionary with transaction metadata for frontend signing
        """
        try:
            logger.info(f"Building unstake transaction: {amount} MIST for {sender}")

            target = f"{settings.STAKE_PACKAGE_ID}::{settings.STAKE_MODULE}::unstake"

            logger.info(f"Unstake transaction metadata built for target: {target}")

            return {
                "success": True,
                "transaction_type": "unstake",
                "target": target,
                "stake_pool_id": stake_pool_id,
                "amount": int(amount),
                "sender": sender,
                "action": "unstake",
                "message": f"Transaction ready. Sign with your wallet to unstake {int(amount)/1_000_000_000:.4f} SUI."
            }

        except Exception as e:
            logger.error(f"Error building unstake transaction: {str(e)}", exc_info=True)
            raise ValueError(f"Error building unstake transaction: {str(e)}")

    def get_user_stake(self, user_address: str, stake_pool_id: str) -> Dict[str, Any]:
        """
        Get user's staked amount from the StakePool using devInspect.
        
        Args:
            user_address: User's wallet address
            stake_pool_id: The StakePool shared object ID
            
        Returns:
            Dictionary with user's stake info
        """
        try:
            logger.info(f"Getting stake info for {user_address} from pool {stake_pool_id}")
            
            import httpx
            
            # First, get the StakePool object to check if user has stake
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "sui_getObject",
                "params": [
                    stake_pool_id,
                    {
                        "showType": True,
                        "showContent": True
                    }
                ]
            }
            
            response = httpx.post(settings.SUI_RPC_URL, json=payload, timeout=10.0)
            result = response.json()
            
            if "error" in result:
                logger.error(f"RPC error: {result['error']}")
                return {"staked": 0, "staked_formatted": "0.0000"}
            
            obj_data = result.get("result", {}).get("data", {})
            content = obj_data.get("content", {})
            fields = content.get("fields", {})
            
            # Get total balance of the pool
            balance = fields.get("balance", 0)
            total_staked = int(balance) if balance else 0
            
            # Parse the stakes table to find user's stake
            stakes = fields.get("stakes", {})
            user_stake = 0
            
            # Stakes is a Table - we'd need to query dynamic fields
            # For MVP, return the pool info
            logger.info(f"StakePool total balance: {total_staked}")
            
            return {
                "pool_id": stake_pool_id,
                "total_staked": total_staked,
                "total_staked_formatted": f"{total_staked / 1_000_000_000:.4f}",
                "user_staked": 0,  # TODO: Query user's stake from Table
                "user_staked_formatted": "0.0000"
            }
            
        except Exception as e:
            logger.error(f"Error getting stake info: {str(e)}", exc_info=True)
            return {"staked": 0, "staked_formatted": "0.0000", "error": str(e)}

    # Keep old async functions for backwards compatibility but mark deprecated
    async def build_stake_transaction(
        self,
        sender: str,
        amount: str,
        token_type: TokenType = TokenType.SUI
    ) -> Dict[str, Any]:
        """DEPRECATED: Use build_stake_tx instead"""
        logger.warning("build_stake_transaction is deprecated, use build_stake_tx")
        stake_pool_id = self.get_stake_pool_id()
        if not stake_pool_id:
            raise ValueError("StakePool not configured. Set STAKE_POOL_OBJECT_ID in .env")
        return self.build_stake_tx(sender, amount, stake_pool_id, token_type)

    async def build_unstake_transaction(
        self,
        sender: str,
        amount: str,
        token_type: TokenType = TokenType.SUI
    ) -> Dict[str, Any]:
        """DEPRECATED: Use build_unstake_tx instead"""
        logger.warning("build_unstake_transaction is deprecated, use build_unstake_tx")
        stake_pool_id = self.get_stake_pool_id()
        if not stake_pool_id:
            raise ValueError("StakePool not configured. Set STAKE_POOL_OBJECT_ID in .env")
        return self.build_unstake_tx(sender, amount, stake_pool_id, token_type)

    # =========================================================================
    # Address Book Operations (On-Chain Contact Storage)
    # =========================================================================

    def build_create_address_book_tx(self, sender: str) -> Dict[str, Any]:
        """
        Build a transaction to create a new address book for the user

        Args:
            sender: User's wallet address

        Returns:
            Dictionary with transaction bytes for frontend signing

        Raises:
            ValueError: If transaction building fails
        """
        try:
            logger.info(f"Building create_address_book transaction for {sender}")

            # Return transaction metadata for frontend to build with @mysten/sui
            # Frontend will use Transaction.moveCall() and signAndExecute
            target = f"{settings.ADDRESS_BOOK_PACKAGE_ID}::{settings.ADDRESS_BOOK_MODULE}::create_address_book"

            logger.info(f"Transaction metadata built for target: {target}")

            return {
                "success": True,
                "transaction_type": "move_call",
                "target": target,
                "arguments": [],
                "type_arguments": [],
                "sender": sender,
                "action": "create_address_book",
                "message": "Transaction ready. Sign with your wallet to create address book."
            }

        except Exception as e:
            logger.error(f"Error building create_address_book transaction: {str(e)}", exc_info=True)
            raise ValueError(f"Error building create_address_book transaction: {str(e)}")

    def build_add_contact_tx(
        self,
        sender: str,
        address_book_id: str,
        contact_key: str,
        encrypted_data: bytes,
        nonce: bytes,
        timestamp: int
    ) -> Dict[str, Any]:
        """
        Build a transaction to add an encrypted contact to the address book

        Args:
            sender: User's wallet address
            address_book_id: ID of the user's AddressBook object
            contact_key: Plain text key for the contact (e.g., "alice", "mom")
            encrypted_data: Seal-encrypted contact data
            nonce: Encryption nonce/IV
            timestamp: Current timestamp (Unix epoch)

        Returns:
            Dictionary with transaction bytes for frontend signing

        Raises:
            ValueError: If transaction building fails
        """
        try:
            logger.info(f"Building add_contact transaction for {sender}, key: {contact_key}")

            target = f"{settings.ADDRESS_BOOK_PACKAGE_ID}::{settings.ADDRESS_BOOK_MODULE}::add_contact"

            # Convert bytes to hex strings for JSON transport
            encrypted_data_hex = encrypted_data.hex() if isinstance(encrypted_data, bytes) else encrypted_data
            nonce_hex = nonce.hex() if isinstance(nonce, bytes) else nonce

            logger.info(f"Transaction metadata built for target: {target}")

            return {
                "success": True,
                "transaction_type": "move_call",
                "target": target,
                "arguments": [
                    {"type": "object", "value": address_book_id},
                    {"type": "string", "value": contact_key},
                    {"type": "vector_u8", "value": encrypted_data_hex},
                    {"type": "vector_u8", "value": nonce_hex},
                    {"type": "u64", "value": timestamp}
                ],
                "type_arguments": [],
                "sender": sender,
                "contact_key": contact_key,
                "action": "add_contact",
                "message": f"Transaction ready. Sign with your wallet to save contact '{contact_key}'."
            }

        except Exception as e:
            logger.error(f"Error building add_contact transaction: {str(e)}", exc_info=True)
            raise ValueError(f"Error building add_contact transaction: {str(e)}")

    def build_update_contact_tx(
        self,
        sender: str,
        address_book_id: str,
        contact_key: str,
        encrypted_data: bytes,
        nonce: bytes,
        timestamp: int
    ) -> Dict[str, Any]:
        """
        Build a transaction to update an existing contact in the address book

        Args:
            sender: User's wallet address
            address_book_id: ID of the user's AddressBook object
            contact_key: Plain text key for the contact (e.g., "alice", "mom")
            encrypted_data: Contact data (JSON bytes for MVP)
            nonce: Nonce/IV
            timestamp: Current timestamp (Unix epoch)

        Returns:
            Dictionary with transaction metadata for frontend signing
        """
        try:
            logger.info(f"Building update_contact transaction for {sender}, key: {contact_key}")

            target = f"{settings.ADDRESS_BOOK_PACKAGE_ID}::{settings.ADDRESS_BOOK_MODULE}::update_contact"

            # Convert bytes to hex strings for JSON transport
            encrypted_data_hex = encrypted_data.hex() if isinstance(encrypted_data, bytes) else encrypted_data
            nonce_hex = nonce.hex() if isinstance(nonce, bytes) else nonce

            logger.info(f"Transaction metadata built for target: {target}")

            return {
                "success": True,
                "transaction_type": "move_call",
                "target": target,
                "arguments": [
                    {"type": "object", "value": address_book_id},
                    {"type": "string", "value": contact_key},
                    {"type": "vector_u8", "value": encrypted_data_hex},
                    {"type": "vector_u8", "value": nonce_hex},
                    {"type": "u64", "value": timestamp}
                ],
                "type_arguments": [],
                "sender": sender,
                "contact_key": contact_key,
                "action": "update_contact",
                "message": f"Transaction ready. Sign with your wallet to update contact '{contact_key}'."
            }

        except Exception as e:
            logger.error(f"Error building update_contact transaction: {str(e)}", exc_info=True)
            raise ValueError(f"Error building update_contact transaction: {str(e)}")

    def get_user_address_book(self, user_address: str) -> Optional[Dict[str, Any]]:
        """
        Find the user's AddressBook object on-chain

        Args:
            user_address: User's wallet address

        Returns:
            Dictionary with address book info or None if not found
        """
        try:
            logger.info(f"Looking up AddressBook for user: {user_address}")

            # Query owned objects using Sui RPC
            import httpx

            # Build the type filter for AddressBook
            address_book_type = f"{settings.ADDRESS_BOOK_PACKAGE_ID}::{settings.ADDRESS_BOOK_MODULE}::AddressBook"

            # Use suix_getOwnedObjects RPC call
            rpc_url = settings.SUI_RPC_URL

            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "suix_getOwnedObjects",
                "params": [
                    user_address,
                    {
                        "filter": {
                            "StructType": address_book_type
                        },
                        "options": {
                            "showType": True,
                            "showContent": True,
                            "showOwner": True
                        }
                    }
                ]
            }

            response = httpx.post(rpc_url, json=payload, timeout=10.0)
            result = response.json()

            if "error" in result:
                logger.error(f"RPC error: {result['error']}")
                return None

            data = result.get("result", {}).get("data", [])

            if not data:
                logger.info(f"No AddressBook found for user: {user_address}")
                return None

            # Get the first AddressBook (user should only have one)
            address_book = data[0]
            object_id = address_book.get("data", {}).get("objectId")

            logger.info(f"Found AddressBook: {object_id}")

            return {
                "object_id": object_id,
                "owner": user_address,
                "type": address_book_type
            }

        except Exception as e:
            logger.error(f"Error looking up AddressBook: {str(e)}", exc_info=True)
            return None

    def get_address_book_contacts(self, address_book_id: str) -> Optional[Dict[str, Any]]:
        """
        Read all contacts from an AddressBook object on-chain.

        Args:
            address_book_id: The AddressBook object ID

        Returns:
            Dictionary with contacts data or None if not found
        """
        try:
            logger.info(f"Reading AddressBook contacts: {address_book_id}")

            import httpx

            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "sui_getObject",
                "params": [
                    address_book_id,
                    {
                        "showType": True,
                        "showContent": True
                    }
                ]
            }

            response = httpx.post(settings.SUI_RPC_URL, json=payload, timeout=10.0)
            result = response.json()

            if "error" in result:
                logger.error(f"RPC error: {result['error']}")
                return None

            obj_data = result.get("result", {}).get("data", {})
            content = obj_data.get("content", {})

            if content.get("dataType") != "moveObject":
                logger.error(f"Unexpected data type: {content.get('dataType')}")
                return None

            fields = content.get("fields", {})
            contacts_map = fields.get("contacts", {})

            # VecMap is stored as an array of {key, value} pairs
            contacts = {}
            if isinstance(contacts_map, dict) and "fields" in contacts_map:
                # Handle VecMap structure: {type, fields: {contents: [{fields: {key, value}}]}}
                contents = contacts_map.get("fields", {}).get("contents", [])
                for entry in contents:
                    entry_fields = entry.get("fields", {})
                    contact_key = entry_fields.get("key", "")
                    value_fields = entry_fields.get("value", {}).get("fields", {})

                    contacts[contact_key] = {
                        "encrypted_data": value_fields.get("encrypted_data", []),
                        "nonce": value_fields.get("nonce", []),
                        "created_at": value_fields.get("created_at", 0),
                        "updated_at": value_fields.get("updated_at", 0)
                    }

            logger.info(f"Found {len(contacts)} contacts in AddressBook")

            return {
                "object_id": address_book_id,
                "owner": fields.get("owner", ""),
                "contact_count": fields.get("contact_count", 0),
                "contacts": contacts
            }

        except Exception as e:
            logger.error(f"Error reading AddressBook contacts: {str(e)}", exc_info=True)
            return None

    def resolve_contact_address(self, user_address: str, contact_key: str) -> Optional[str]:
        """
        Resolve a contact name to a wallet address.

        Args:
            user_address: User's wallet address
            contact_key: Contact key (e.g., "alice", "mom")

        Returns:
            Wallet address if found and decodable, None otherwise
        """
        try:
            logger.info(f"Resolving contact '{contact_key}' for user {user_address}")

            # Get user's address book
            address_book = self.get_user_address_book(user_address)
            if not address_book:
                logger.info("No address book found")
                return None

            # Get contacts from address book
            contacts_data = self.get_address_book_contacts(address_book["object_id"])
            if not contacts_data:
                logger.info("Could not read contacts from address book")
                return None

            contacts = contacts_data.get("contacts", {})
            
            # Case-insensitive lookup - try exact match first, then case-insensitive
            contact_key_normalized = contact_key.lower().replace(" ", "_")
            
            # Find matching contact key (case-insensitive)
            matched_key = None
            for key in contacts.keys():
                if key.lower() == contact_key_normalized:
                    matched_key = key
                    break
            
            if not matched_key:
                logger.info(f"Contact '{contact_key}' not found. Available: {list(contacts.keys())}")
                return None

            contact = contacts[matched_key]
            encrypted_data = contact.get("encrypted_data", [])

            # Try to decode contact data
            try:
                if isinstance(encrypted_data, list) and len(encrypted_data) > 0:
                    # Convert byte array to string
                    address_bytes = bytes(encrypted_data)
                    
                    # Try to parse as JSON (new save format)
                    import json
                    try:
                        contact_info = json.loads(address_bytes.decode('utf-8'))
                        resolved_address = contact_info.get("address", "")
                        if resolved_address and resolved_address.startswith("0x"):
                            logger.info(f"Resolved contact '{contact_key}' to address: {resolved_address[:20]}...")
                            return resolved_address
                    except json.JSONDecodeError:
                        # Not JSON - might be old encrypted format or plain address
                        decoded_str = address_bytes.decode('utf-8', errors='ignore').strip()
                        if decoded_str.startswith("0x") and len(decoded_str) >= 66:
                            logger.info(f"Resolved contact '{contact_key}' as plain address: {decoded_str[:20]}...")
                            return decoded_str
                        
            except Exception as decode_error:
                logger.warning(f"Could not decode contact data for '{matched_key}': {decode_error}")
            
            # Contact exists but data cannot be decoded
            logger.info(f"Contact '{matched_key}' exists but data format is incompatible. Needs re-save.")
            return "NEEDS_RESAVE"  # Special marker

        except Exception as e:
            logger.error(f"Error resolving contact: {str(e)}", exc_info=True)
            return None


# Global service instance
sui_service = SuiService()



