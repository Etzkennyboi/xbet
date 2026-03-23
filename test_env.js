import dotenv from 'dotenv';
dotenv.config();
console.log(`PASSPHRASE: ${process.env.OKX_PASSPHRASE}`);
if (process.env.OKX_PASSPHRASE.includes('Skippy2000')) {
    console.log("✅ Passphrase loaded correctly.");
} else {
    console.log("❌ Passphrase loading failed (interpolation issue likely).");
}
process.exit();
