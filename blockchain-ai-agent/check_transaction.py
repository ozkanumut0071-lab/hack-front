"""
Check transaction result and verify AddressBook creation
"""
import httpx
import json

SUI_RPC_URL = "https://fullnode.testnet.sui.io:443"
TX_DIGEST = "3pzM9E4sJpBbPMBtWhR5ad9cURpMFc6bmuWM2Lw5o8aQ"
USER_ADDRESS = "0x6d2214052b18cc9ff2f97cb904343a47ab9d85453e45e9477197e75eab365eac"
PACKAGE_ID = "0x8e385abb2ccefc0aed625567e72c8005f06ae3a97d534a25cb8e5dd2b62f6f9c"

def get_transaction(digest: str):
    """Get transaction details"""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "sui_getTransactionBlock",
        "params": [
            digest,
            {
                "showInput": True,
                "showEffects": True,
                "showEvents": True,
                "showObjectChanges": True
            }
        ]
    }

    response = httpx.post(SUI_RPC_URL, json=payload, timeout=10.0)
    return response.json()

def get_owned_objects(address: str):
    """Get all objects owned by address"""
    address_book_type = f"{PACKAGE_ID}::address_book::AddressBook"

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "suix_getOwnedObjects",
        "params": [
            address,
            {
                "filter": {
                    "StructType": address_book_type
                },
                "options": {
                    "showType": True,
                    "showContent": True
                }
            }
        ]
    }

    response = httpx.post(SUI_RPC_URL, json=payload, timeout=10.0)
    return response.json()

if __name__ == "__main__":
    print("=" * 60)
    print(f"Checking transaction: {TX_DIGEST}")
    print("=" * 60)

    # Get transaction details
    tx_result = get_transaction(TX_DIGEST)

    if "result" in tx_result:
        result = tx_result["result"]

        # Check status
        effects = result.get("effects", {})
        status = effects.get("status", {})
        print(f"\nTransaction Status: {status.get('status')}")

        if status.get("status") != "success":
            print(f"Error: {status.get('error')}")

        # Check object changes
        object_changes = result.get("objectChanges", [])
        print(f"\nObject Changes ({len(object_changes)}):")
        for change in object_changes:
            change_type = change.get("type")
            obj_type = change.get("objectType", "")
            obj_id = change.get("objectId", "")
            print(f"  - {change_type}: {obj_type[:50]}... ID: {obj_id[:20]}...")

            if "AddressBook" in obj_type:
                print(f"\n  *** ADDRESSBOOK CREATED! ***")
                print(f"      Object ID: {obj_id}")

        # Check events
        events = result.get("events", [])
        print(f"\nEvents ({len(events)}):")
        for event in events:
            event_type = event.get("type", "")
            print(f"  - {event_type}")
    else:
        print(f"Error: {tx_result.get('error')}")

    # Now check if AddressBook exists
    print("\n" + "=" * 60)
    print("Checking for AddressBook objects...")
    print("=" * 60)

    address_books = get_owned_objects(USER_ADDRESS)

    if "result" in address_books:
        data = address_books["result"].get("data", [])
        print(f"\nFound {len(data)} AddressBook objects")

        for obj in data:
            obj_data = obj.get("data", {})
            print(f"\nAddressBook:")
            print(f"  Object ID: {obj_data.get('objectId')}")
            print(f"  Type: {obj_data.get('type')}")
    else:
        print(f"Error: {address_books.get('error')}")
