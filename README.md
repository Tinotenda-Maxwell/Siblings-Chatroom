# Sibling Chat

A real-time one-to-one chat app. Sign up, find people by username, send a friend request, and message them once they accept. Built with React, TypeScript, Vite and Supabase.

## Features

- Email/password sign-up and login (Supabase Auth) with protected routes
- User search and a friend-request flow (`pending` → `accepted` / `rejected`)
- Real-time messaging: new messages, deletions and friendship changes arrive live
- Image attachments, downscaled and compressed in the browser before sending
- Emoji picker and an auto-growing message input
- Route-level code splitting for fast first load

## Tech stack

- [React 19](https://react.dev) + [React Router 7](https://reactrouter.com)
- [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev)
- [Supabase](https://supabase.com) (Auth, Postgres, Realtime)
- ESLint with `typescript-eslint` and the React hooks rules

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A Supabase project

### Installation

```bash
git clone <repo-url>
cd sibling-chat
npm install
```

### Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Both values are in your Supabase dashboard under **Project Settings → API**. The app throws on startup if either is missing. `.env` is git-ignored, so don't commit it.

### Supabase setup

The app expects these tables in the `public` schema. Enable Realtime on `messages` and `friendships`, and add Row Level Security policies suited to your project.

| Table         | Columns                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `profiles`    | `id` (= auth user id), `username`, `display_name`, `avatar_url`, `created_at` |
| `friendships` | `id`, `sender_id`, `receiver_id`, `status` (`pending`/`accepted`/`rejected`), `created_at` |
| `messages`    | `id`, `sender_id`, `receiver_id`, `message`, `created_at`              |

If email confirmation is enabled in Supabase Auth, new users must confirm their email before logging in.

### Run it

```bash
npm run dev       # start the dev server with HMR
npm run build     # type-check and build for production into dist/
npm run preview   # serve the production build locally
npm run lint      # run ESLint
```

## Project structure

```
src/
├── components/   # AuthProvider, ProtectedRoute, Header, Sidebar, Chat, MessageInput
├── hooks/        # useSession, useConversations, useMessages, useUserSearch
├── pages/        # Login, Register, ChatPage
├── services/
│   ├── supabase.ts      # Supabase client
│   ├── messageFeed.ts   # single shared realtime channel per signed-in user
│   └── mappers.ts       # DB row → typed object helpers, image message parsing
├── types/        # Profile, Message, Friendship
├── App.tsx       # routes (lazy-loaded)
└── main.tsx
```

## How it works

- **Routing:** `/login` and `/register` are public. `/` (the chat) is wrapped in `ProtectedRoute`, and unknown paths redirect to `/`.
- **Realtime:** `messageFeed.ts` keeps one long-lived Supabase channel per user and fans events out to the hooks. This avoids dropped events from opening a channel per conversation.
- **Images:** attachments are resized (max 1280px), re-encoded as JPEG and stored inline in the message text as `[Image: name] (data:image/...)`. They are capped at 2 MB after compression, and GIF and SVG files are sent unchanged.
- **Avatars:** users without an avatar get a generated one from [DiceBear](https://www.dicebear.com).

## License

No license specified. This is a private project.
