# SD-Draw: Supabase & Deployment Guide

This guide covers everything you need to do to get your newly converted SD-Draw (Supabase version) running both locally and deployed to Render. 

> [!NOTE]
> **Good News!** I've thoroughly reviewed the current codebase (`frontend/`) and compared it with your previous MongoDB/JWT version (`SD-Draw-master/`). 
> 
> The core functionality—the canvas engine, tools, history stack, and real-time PeerJS collaboration—**remains exactly the same**. The only changes made were migrating the backend authentication and the save/load mechanism to directly interface with Supabase instead of a custom Express backend. The local storage token mechanics were preserved so your guest mode and protected routes still work flawlessly!

---

## 1. Setting up Supabase

Since SD-Draw now uses Supabase for Authentication and Database storage, you'll need to set up a new project on Supabase.

1. Go to [Supabase](https://supabase.com/) and create a new project.
2. **Configure Authentication**:
   - Navigate to **Authentication** > **Providers**.
   - Ensure **Email** provider is enabled.
   - *(Optional but recommended for testing)*: Turn off "Confirm email" under **Auth -> Providers -> Email** so you don't have to verify every test account you create.
3. **Configure Database**:
   - Navigate to the **SQL Editor** on the left sidebar.
   - Click "New Query" and paste the following SQL to create your `canvases` table and configure Row Level Security (RLS) to ensure users can only access their own drawings:

```sql
-- Create canvases table
CREATE TABLE canvases (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    elements JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own canvases
CREATE POLICY "Users can insert their own canvas" 
ON canvases FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can select their own canvases
CREATE POLICY "Users can view their own canvas" 
ON canvases FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Users can update their own canvases
CREATE POLICY "Users can update their own canvas" 
ON canvases FOR UPDATE 
USING (auth.uid() = user_id);
```
   - Click **Run** to execute the query.

4. **Get your API Keys**:
   - Go to **Project Settings** (the gear icon) > **API**.
   - Note down the **Project URL** and the **anon / public** key. You will need these for your environment variables.

---

## 2. Environment Variables (.env)

Your project uses Vite, so environment variables must be prefixed with `VITE_`. In your `frontend` directory, there is a file named `.env.example`. 

You need to create a new file named `.env` in the **same directory** (`frontend/`) and add your Supabase keys to it.

**`frontend/.env`**
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-long-anon-public-key
```

> [!CAUTION]
> Never commit your `.env` file to GitHub! The `.gitignore` file already excludes it, but always be mindful not to accidentally expose these keys.

---

## 3. Running Locally

With the database set up and the `.env` file populated, you are ready to run SD-Draw locally.

1. Open your terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the provided Local URL (usually `http://localhost:5173/`) in your browser. You can now register an account, log in, and test the save/load functionality which will sync directly to your Supabase project!

---

## 4. Deploying to Render (Single Service)

Because you have completely replaced the Node/Express backend with Supabase, SD-Draw is now a **Single-Page Application (SPA)**. This means you don't need a complex Web Service backend on Render anymore; you can deploy it quickly, cheaply, and easily as a **Static Site**.

Here is how to deploy SD-Draw to Render:

1. **Push to GitHub**: Make sure your current project (specifically the `frontend` folder and its `package.json`) is pushed to a GitHub repository. 
   *(Note: If your root folder is the GitHub repo, ensure the `frontend` folder is pushed as well).*
2. **Log into Render**: Go to your [Render Dashboard](https://dashboard.render.com/).
3. **Create a New Static Site**:
   - Click **New +** and select **Static Site**.
   - Connect your GitHub account and select your SD-Draw repository.
4. **Configure the Static Site Settings**:
   - **Name**: `sd-draw` (or whatever you prefer)
   - **Root Directory**: `frontend` *(This is important! Render needs to know where the code is)*
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `frontend/dist` *(This is where Vite outputs the compiled app)*
5. **Set Environment Variables**:
   - Scroll down to the **Environment Variables** section.
   - Click **Add Environment Variable** and add the exact same keys from your local `.env` file:
     - `VITE_SUPABASE_URL` = `https://your-project-id.supabase.co`
     - `VITE_SUPABASE_ANON_KEY` = `your-long-anon-public-key`
6. **Rewrite Rules for React Router**:
   - Go to the **Redirects/Rewrites** tab in the sidebar of your newly created Render service (or during creation under "Advanced").
   - Add a rule to route all traffic to `index.html` so React Router can handle the paths:
     - **Source**: `/*`
     - **Destination**: `/index.html`
     - **Action**: `Rewrite`
7. **Deploy**:
   - Click **Create Static Site**.
   - Render will now pull your code, run the build command, and publish your app!

> [!TIP]
> Once deployed, you can visit the URL Render gives you. Since Supabase handles everything from its own servers, your static Render site will communicate securely with your Supabase backend using the environment variables provided.
