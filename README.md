# 🎮 PokéWatch — Your Setup Guide

**Made for non-technical folks. Take it one step at a time. You've got this.**

This guide gets PokéWatch running so it checks Pokémon Center, Target, Walmart, Best Buy, Barnes & Noble, and Kohl's around the clock and buzzes your iPhone when something's in stock.

There are 3 parts. Total time: about 15–20 minutes. Don't rush — if you get stuck on any step, that's exactly where to ask for help.

---

## 📋 What you'll end up with

An icon on your iPhone home screen called "PokéWatch." You tap it, paste in product links, and it watches them 24/7. When a card set comes back in stock, your phone buzzes with a notification. You tap it, it opens the store page, and you buy it yourself. (It never buys anything for you — you stay in control.)

---

# PART 1 — Put PokéWatch online (the "server")

PokéWatch needs to live on the internet so it can run even when your phone is in your pocket. We'll use **Render.com**, which is free.

### Step 1.1 — Make a GitHub account
GitHub is where the code will live.
1. Open a web browser on your **computer** (easier than phone for this part)
2. Go to **github.com**
3. Click **Sign up** and follow the prompts (it's free)

### Step 1.2 — Upload the code to GitHub
1. After signing in, go to **github.com/new**
2. Under "Repository name" type: `pokewatch`
3. Leave everything else as-is, click **Create repository**
4. On the next page, click the link that says **"uploading an existing file"**
5. Drag ALL the files and folders from the PokéWatch folder into the upload box
   - ⚠️ Important: make sure the `public` folder and its contents come along too
6. Click **Commit changes** at the bottom

### Step 1.3 — Make a Render.com account
1. Go to **render.com**
2. Click **Get Started** → sign up with your **GitHub** account (one click)

### Step 1.4 — Deploy it
1. In Render, click **New +** (top right) → **Web Service**
2. Find and select your `pokewatch` repository → click **Connect**
3. Render reads the settings automatically. Scroll down, click **Create Web Service**
4. Wait about 5 minutes while it builds. You'll see logs scrolling — that's normal.
5. When it says **"Live"** at the top, you're done with this step!

### Step 1.5 — Copy your app's web address
Near the top of the Render page, you'll see a link like:
`https://pokewatch-xxxx.onrender.com`
**That's your PokéWatch.** Write it down or text it to yourself.

---

# PART 2 — Turn on phone notifications (VAPID keys)

This is the part that lets your phone buzz. We need to create two secret "keys."

### Step 2.1 — Generate your keys
The easiest way without installing anything:
1. In your Render dashboard, click your **pokewatch** service
2. Click the **Shell** tab (left side menu)
3. In the black box that appears, type this and press Enter:
   ```
   node generate-keys.js
   ```
4. It prints out three lines starting with `VAPID_`. **Copy all three.**

> 💡 If you don't see a Shell tab (free plans sometimes hide it), tell me and I'll walk you through doing it on your own computer instead — it's just as easy.

### Step 2.2 — Add the keys to Render
1. In your pokewatch service, click the **Environment** tab
2. Click **Add Environment Variable** and add each one:
   - Key: `VAPID_PUBLIC_KEY` → Value: (paste the public key)
   - Key: `VAPID_PRIVATE_KEY` → Value: (paste the private key)
   - Key: `VAPID_EMAIL` → Value: `mailto:youremail@gmail.com` (use your real email)
3. Click **Save Changes**. Render restarts automatically (~2 min).

---

# PART 3 — Install PokéWatch on your iPhone

### Step 3.1 — Open it in Safari
1. On your iPhone, open **Safari** (must be Safari — not Chrome)
2. Go to your app address from Step 1.5 (`https://pokewatch-xxxx.onrender.com`)

### Step 3.2 — Add to Home Screen
1. Tap the **Share button** (the square with an arrow pointing up, at the bottom)
2. Scroll down the list, tap **Add to Home Screen**
3. Tap **Add** (top right)
4. Close Safari. Find the new **PokéWatch** icon on your home screen and tap it to open.

> ⚠️ This step matters: iPhone push notifications ONLY work when you open PokéWatch from the home screen icon, not from Safari.

### Step 3.3 — Turn on notifications
1. With PokéWatch open, tap **Enable Push Notifications**
2. When iOS asks, tap **Allow**
3. The dot turns green — you're all set! 🎉

### Step 3.4 — Test it
Go to the **Settings** tab in the app and tap **🔔 Test Alert**. You should hear a chime and see the alert pop up. 

---

# 🎯 Using PokéWatch day-to-day

1. **Add products to watch:** Tap the **+ Add** tab
   - Use the **Quick Add** chips for each store's Pokémon section, OR
   - Paste a specific product link (best for a specific ETB you want)
2. **To get a specific product link:** On the store's website, open the exact product page, copy the web address from the top of the browser, and paste it into PokéWatch's "Product Page URL" box.
3. **Walk away.** The server checks every few minutes. When something's in stock, your phone buzzes.
4. **When you get an alert:** Tap it → it opens the store page → check the price → buy if it's right.

---

# 💡 Important tips

- **Pokémon Center is the toughest.** They have strong anti-bot walls, so checks there get blocked sometimes. Set the interval to **5 minutes** for best results (Settings tab).
- **Watch all the stores at once** for the same set. Whoever restocks first, you'll know.
- **Free Render servers "go to sleep"** after 15 minutes of no use. To keep yours awake 24/7 for free:
  1. Sign up at **uptimerobot.com** (free)
  2. Add a "monitor" pointing at your Render address, set to check every 5 minutes
  3. This keeps PokéWatch awake. Totally free and legal.

---

# 🆘 If something goes wrong

- **App says "Offline":** Your Render server is asleep. Open the app and wait 30 seconds, or set up UptimeRobot above.
- **No notification received:** Make sure you opened PokéWatch from the **home screen icon**, not Safari. Re-check the VAPID keys in Render's Environment tab.
- **A store always shows "Blocked":** Normal for Pokémon Center. Bump the interval to 10 minutes.
- **Stuck anywhere:** Take a screenshot and ask me. We'll sort it out together.

---

*PokéWatch checks store pages the same way you would by hand — it just never gets tired. You always do the actual buying.*
