const CryptoJS = require("crypto-js");

const AES_SECRET = process.env.AES_SECRET;

if (!AES_SECRET) {
  console.error("⚠️ WARNING: AES_SECRET is missing in .env. Encryption will fail.");
}

const encryptData = (text) => {
  if (!text) return null;
  if (!AES_SECRET) throw new Error("AES_SECRET is not defined");
  return CryptoJS.AES.encrypt(text, AES_SECRET).toString();
};

const decryptData = (cipher) => {
  if (!cipher) return null;
  if (!AES_SECRET) throw new Error("AES_SECRET is not defined");
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, AES_SECRET);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) {
      console.log("⚠️ Safe Decrypt Skip (Not Encrypted Yet)");
      return cipher;
    }
    return originalText;
  } catch (error) {
    console.log("⚠️ Safe Decrypt Skip (Not Encrypted Yet)");
    return cipher;
  }
};

// SHA256 Hash for searchable fields (deterministic)
const hashData = (text) => {
  if (!text) return null;
  return CryptoJS.SHA256(text).toString();
};

module.exports = { encryptData, decryptData, hashData };
