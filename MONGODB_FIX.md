# MongoDB Connection Fix Guide

## The Error You're Getting
```
❌ MongoDB Connection Error: CC4B0000:error:0A000438:SSL routines:ssl3_read_bytes:tlsv1 alert internal error
```

This is a **TLS/SSL handshake error** with MongoDB Atlas.

---

## ✅ Solutions (Try in Order)

### Solution 1: Check Your .env File

Your `.env` file should have a connection string like this:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

**Important:**
- Replace `username` with your MongoDB username
- Replace `password` with your MongoDB password
- Replace `cluster` with your cluster name
- Replace `database` with your database name

**If your password has special characters** (like `@`, `#`, `!`, `%`), you MUST URL-encode them:
- `@` → `%40`
- `#` → `%23`
- `!` → `%21`
- `%` → `%25`
- `&` → `%26`

Example:
```
Password: MyP@ss#123
Encoded:  MyP%40ss%23123
```

---

### Solution 2: Whitelist Your IP Address in MongoDB Atlas

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Click on **Network Access** in the left sidebar
3. Click **Add IP Address**
4. Choose **Allow Access from Anywhere** (0.0.0.0/0) for testing
   - Or add your specific IP address
5. Click **Confirm**
6. Wait 1-2 minutes for changes to propagate

---

### Solution 3: Update Your Connection String Format

If you're using an old connection string, update it to the new format:

**Old format (won't work):**
```
mongodb://username:password@cluster.mongodb.net:27017/database
```

**New format (correct):**
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

Notice the `+srv` after `mongodb`.

---

### Solution 4: Check MongoDB Atlas Cluster Status

1. Go to MongoDB Atlas dashboard
2. Check if your cluster is **Active** (green)
3. If it's paused, click **Resume** to restart it

---

### Solution 5: Create a New Database User

Sometimes the user credentials get corrupted:

1. Go to MongoDB Atlas → **Database Access**
2. Click **Add New Database User**
3. Create a new user with:
   - Username: `buspass_admin`
   - Password: Use **Autogenerate Secure Password** (copy it!)
   - Database User Privileges: **Read and write to any database**
4. Click **Add User**
5. Update your `.env` file with the new credentials

---

## 🧪 Test Your Connection

After making changes, restart your server:

```bash
cd backend
node server.js
```

You should see:
```
🔄 Attempting to connect to MongoDB...
✅ MongoDB Connected Successfully
🚀 Server running on http://localhost:5000
```

---

## 🔍 Still Not Working?

If you're still getting errors, please share:
1. Your MongoDB connection string format (hide password with `****`)
2. The full error message from the terminal
3. Whether your cluster is on MongoDB Atlas or self-hosted

Example:
```
MONGO_URI=mongodb+srv://myuser:****@cluster0.xxxxx.mongodb.net/buspass?retryWrites=true&w=majority
```

---

## 📝 Quick Checklist

- [ ] Connection string uses `mongodb+srv://` format
- [ ] Password is URL-encoded if it has special characters
- [ ] IP address is whitelisted in MongoDB Atlas (0.0.0.0/0 for testing)
- [ ] MongoDB cluster is active (not paused)
- [ ] Database user has correct permissions
- [ ] Connection string includes `?retryWrites=true&w=majority`
- [ ] `.env` file is in the `backend` folder
- [ ] No extra spaces in the connection string

---

## 🎯 Most Common Fix

**90% of the time, the issue is one of these:**
1. **Special characters in password not URL-encoded**
2. **IP address not whitelisted in MongoDB Atlas**
3. **Missing `+srv` in connection string**

Try these three first!


---

## Development Database Cleanup

If you encounter encryption errors, clean the database and re-register users:

### Method 1: MongoDB Shell
```javascript
use smartbuspass
db.users.deleteMany({})
db.wallets.deleteMany({})
db.transactions.deleteMany({})
```

### Method 2: MongoDB Compass
1. Connect to your local MongoDB
2. Select `smartbuspass` database
3. Delete all documents from `users`, `wallets`, and `transactions` collections

⚠️ **WARNING:** Only use in development! Never run in production!

After cleanup, restart the server and register fresh users.
