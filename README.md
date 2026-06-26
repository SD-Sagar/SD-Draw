# SD-Draw

SD-Draw is a professional-grade infinite vector canvas application. It features a sleek, MS Paint-inspired floating toolbox with a dynamic dark-mode user interface, real-time collaboration, and cloud syncing via Supabase.

## Architecture

- **Frontend**: React + Vite
- **Canvas Engine**: React-Konva (HTML5 Canvas wrapper for scalable vector graphics)
- **State Management**: Zustand (handles global tool states, history stack, and active elements)
- **Backend & Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time Collaboration**: PeerJS (Peer-to-Peer synchronization)

## Key Features

1. **Infinite Canvas Engine**: Pan infinitely and zoom smoothly.
2. **Vector Drawing Tools**: Pencil, Eraser, Line, Arrow, Rectangle, Circle, Diamond, Hexagon, Star, etc.
3. **Advanced Text Tool**: Dynamically resizing HTML text input.
4. **User Authentication & Persistence**: Full authentication via Supabase. Canvases are uniquely tied to user accounts and persisted in the cloud.
5. **Real-time Collaboration**: Peer-to-peer canvas synchronization powered by PeerJS.
6. **State Control**: Comprehensive Undo/Redo stack.
7. **Export**: Save the active viewport directly to a high-resolution PNG.

---

## 🚀 Local Installation Guide

Follow these steps to get SD-Draw running locally on your machine.

### Prerequisites
- Node.js (v18 or higher recommended)
- Git
- A Supabase Account ([supabase.com](https://supabase.com/))

### Step 1: Set up Supabase Project

Since SD-Draw relies on Supabase for its backend, database, and authentication, you need to configure a Supabase project first.

1. Create a new project in your Supabase dashboard.
2. **Authentication Settings**:
   - Go to **Authentication** > **Providers**.
   - Make sure **Email** is enabled (Confirm email can be turned off for easier local testing).
3. **Database Setup**:
   - Go to the **SQL Editor** in Supabase and run the following query to create the necessary table:

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

4. Go to **Project Settings** > **API** to grab your **Project URL** and **anon public key**.

### Step 2: Clone & Setup Frontend

1. Open a terminal and clone/navigate to the SD-Draw repository.
2. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
3. Install frontend dependencies:
   ```bash
   npm install
   ```

### Step 3: Configure Environment Variables

1. Inside the `frontend` directory, copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
   ```

### Step 4: Launch the Application

1. Start the Vite development server:
   ```bash
   npm run dev
   ```
2. Open your web browser and navigate to the URL provided by Vite (typically `http://localhost:5173/`).
3. You will be greeted by the Login page. 
4. Register a new account or use Guest Mode to start drawing.

---

## 🤝 Real-time Collaboration

1. Once logged in, open the "Collaboration" section in the toolbox.
2. Copy "Your ID" and share it with a friend.
3. Your friend can enter your ID in the "Enter Room ID" box and click "Join".
4. Any changes made by either user will sync in real-time!
