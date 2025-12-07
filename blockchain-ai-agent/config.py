"""
Configuration Management for Sui Blockchain AI Agent
Loads environment variables and provides application settings
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    """
    Application Settings loaded from environment variables
    """

    # OpenAI Configuration
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-2024-08-06"

    # Sui Blockchain Configuration
    SUI_NETWORK: Literal["mainnet", "testnet", "devnet", "localnet"] = "testnet"
    SUI_RPC_URL: str = "https://fullnode.testnet.sui.io:443"

    # Stake Contract Configuration (uses same package as address_book)
    STAKE_PACKAGE_ID: str = "0x8e385abb2ccefc0aed625567e72c8005f06ae3a97d534a25cb8e5dd2b62f6f9c"
    STAKE_MODULE: str = "stake"
    # StakePool shared object (created during module init)
    STAKE_POOL_OBJECT_ID: str = "0x3115704216024fdfb16b823bb5b4f6a7113747ef1c28435fb14e44b5ad19ebd9"

    # Address Book Contract Configuration (On-Chain Contact Storage)
    ADDRESS_BOOK_PACKAGE_ID: str = "0x8e385abb2ccefc0aed625567e72c8005f06ae3a97d534a25cb8e5dd2b62f6f9c"
    ADDRESS_BOOK_MODULE: str = "address_book"

    # Walrus Storage Configuration
    WALRUS_PUBLISHER_URL: str = "https://publisher.walrus-testnet.walrus.space"
    WALRUS_AGGREGATOR_URL: str = "https://aggregator.walrus-testnet.walrus.space"

    # Application Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Security
    SECRET_KEY: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


# Global settings instance
settings = Settings()
