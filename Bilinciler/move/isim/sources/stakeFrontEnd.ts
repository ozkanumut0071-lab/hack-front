import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";

const API_URL = import.meta.env.VITE_API_URL || 'https://hack-back-w2jw.onrender.com';

async function handleStake() {
    // 1. Backend'den oluşturulmuş TX'i al
    const response = await fetch(`${API_URL}/stake/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sender: currentAccount.address, // Cüzdan adresi
            amount: 1000000000 // 1 SUI (MIST cinsinden)
        })
    });

    const { txBytesBase64 } = await response.json();

    // 2. Base64 string'i Transaction objesine çevir
    const txBytes = fromBase64(txBytesBase64);
    const tx = Transaction.from(txBytes);

    // 3. Cüzdan ile imzala ve gönder
    // (dApp Kit kullanıyorsan useSignAndExecuteTransaction hook'u)
    signAndExecuteTransaction(
        { transaction: tx },
        {
            onSuccess: (result) => {
                console.log("Stake Başarılı! Digest:", result.digest);
            },
        }
    );
}