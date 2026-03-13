# ✨ Vialia v4 — AI Driving Prep Platform

A modern, AI-powered, bilingual web application to prepare for the **Spanish DGT Type B driving theory exam**. Built with Next.js 15, Tailwind CSS 4, MongoDB, Groq AI, and Stripe.

---

## ✨ Features

| Feature | Status |
|---|---|
| 🔐 Auth (email/password + JWT) | ✅ |
| 🌍 Bilingual ES/EN toggle | ✅ |
| 📝 Official DGT Exam Simulation (30Q, 30min) | ✅ |
| 🛠️ Custom Practice Exams with topic filter | ✅ |
| ⚡ Instant Feedback Mode | ✅ |
| 📖 DGT Manual explanations (help_html rendering) | ✅ |
| 🃏 Flashcards with Spaced Repetition (SM-2) | ✅ |
| 🤖 AI Readiness Score via Groq | ✅ |
| 📊 Stats Dashboard + Topic breakdown | ✅ |
| 🔥 Daily Streaks (Madrid timezone) | ✅ |
| 🎖️ Badges & Trophy Room | ✅ |
| 🏆 Weekly XP Leaderboard | ✅ |
| 💳 Stripe Subscription paywall | ✅ |
| 🛡️ Admin Panel (questions CRUD + user management) | ✅ |
| 📥 JSON bulk import from MongoDB export | ✅ |
| 📱 **Mobile-First Design** (Sticky bottom navigation) | ✅ |
| 🎨 **Glassmorphic UI** (Premium aesthetic) | ✅ |

---

## 🚀 Quick Start

### 1. Clone and install

```bash
cd autoscuela
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your `.env.local`:

```env
MONGODB_URI=mongodb://localhost:27017/gala_exams    # Your local DB
JWT_SECRET=your-strong-secret-key
GROQ_API_KEY=gsk_...                                # From console.groq.com
STRIPE_SECRET_KEY=sk_test_...                       # From dashboard.stripe.com
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...                           # Your monthly price ID
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Seed your database from gala_exams

```bash
node scripts/seed.js
```

This will:
- ✅ Read all questions from your local `gala_exams` MongoDB
- ✅ Auto-map topic tags based on content keywords
- ✅ Create an admin user (`admin@vialia.com` / `admin123`)

> **Note:** The seed script auto-detects your question document structure.
> Supported field names: `question.es`, `pregunta`, `text_es`, `options`, `opciones`, `correct_option_idx`, etc.

### 4. Start development

```bash
npm run dev
```

Visit: **http://localhost:3000**

---

## 🏗️ Project Structure

```
autoscuela/
├── app/
│   ├── api/                          # Backend API routes
│   │   ├── auth/                     # Login, register, session
│   │   ├── billing/                  # Stripe checkout + webhook
│   │   ├── exams/                    # Exam generation + answers
│   │   ├── flashcards/               # Flashcard practice + review
│   │   ├── stats/                    # Dashboard + AI insights
│   │   ├── gamification/             # Streaks, badges, leaderboard
│   │   └── admin/                    # Questions + users CRUD
│   ├── auth/                         # Login + Register pages
│   ├── dashboard/                    # Home dashboard
│   ├── exam/                         # Exam setup + active exam
│   ├── flashcards/                   # Flashcard module
│   ├── stats/                        # Statistics page
│   ├── leaderboard/                  # Weekly ranking
│   ├── badges/                       # Trophy room
│   └── admin/                        # Admin panel
├── components/
│   ├── AppShell.js                   # Protected layout + paywall
│   ├── AuthContext.js                # Global auth + language state
│   └── Navbar.js                     # Top navigation
├── models/
│   ├── User.js                       # User schema with gamification
│   ├── Question.js                   # Question schema (maps to gala_exams)
│   ├── ExamSession.js                # Active exam state
│   ├── UserAnswer.js                 # Answer log (feeds Groq AI)
│   └── FlashcardProgress.js          # SM-2 spaced repetition
├── lib/
│   ├── db.js                         # MongoDB connection
│   ├── auth.js                       # JWT utilities
│   ├── groq.js                       # Groq AI integration
│   ├── stripe.js                     # Stripe client
│   └── gamification.js              # XP, badges, streak logic
└── scripts/
    └── seed.js                       # Import from gala_exams
```

---

## 🔑 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| DELETE | `/api/auth/me` | Logout |
| PUT | `/api/users/preferences` | Update language/nickname |

### Exams
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/exams/generate` | Create exam session |
| GET | `/api/exams/:sessionId` | Get exam + questions |
| POST | `/api/exams/:sessionId/answer` | Submit answer |
| POST | `/api/exams/:sessionId/submit` | Finalize exam |
| GET | `/api/exams/history` | Past exam history |

### Flashcards
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/flashcards/decks` | Available topic decks |
| GET | `/api/flashcards/practice` | Get cards for review |
| POST | `/api/flashcards/review` | Log review result (SM-2) |

### Stats & AI
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stats/dashboard` | Pass rate, accuracy, topics |
| GET | `/api/stats/ai-insights` | Groq AI readiness score |

### Gamification
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/gamification/streak` | Current streak |
| GET | `/api/gamification/badges` | All badges + status |
| GET | `/api/gamification/leaderboard` | Top 50 weekly XP |

### Billing
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/billing/checkout` | Create Stripe checkout session |
| POST | `/api/billing/webhook` | Stripe webhook handler |

### Admin (admin role only)
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/admin/questions` | List/bulk import questions |
| GET/PUT/DELETE | `/api/admin/questions/:id` | Single question CRUD |
| GET | `/api/admin/users` | User list |
| PATCH | `/api/admin/users/:id` | Grant/revoke premium |

### System
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/keep-alive` | Health check (keeps Render awake) |

---

## 🎮 Gamification

**XP Points:**
- ✅ Pass exam: **+10 XP**
- ❌ Fail exam: **+5 XP** (effort reward)
- 🃏 Correct flashcard: **+1 XP**

**Badges:**
- 🚗 **Primera Marcha** — Complete first exam
- ⭐ **Conducción Perfecta** — Score 30/30
- 🌍 **Conductor Bilingüe** — Exam in both languages
- 🏃 **Maratoniano** — 100 questions in one day
- 🔥 **Guerrero Semanal** — 7-day streak
- 🎓 **Listo para el DGT** — 90% AI readiness score

**Leaderboard:** Resets every Sunday midnight Madrid time.

---

## 🤖 Groq AI Integration

The AI Readiness Score is powered by **Groq's llama-3.1-8b-instant** model.

**Trigger:** After user answers 60+ questions.  
**Cache:** 24 hours or after completing a new exam.  
**Output:** Readiness score (0-100%), weak topics, coach message, recommended study action.

---

## 💳 Stripe Setup

1. Create a product in Stripe Dashboard
2. Create a monthly recurring price (e.g., €9.99/month)
3. Copy the Price ID to `STRIPE_PRICE_ID`
4. Set up webhook endpoint: `https://yourdomain.com/api/billing/webhook`
5. Listen for: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`

---

## 🛡️ Admin Access

After running the seed script:
- URL: `http://localhost:3000/admin`
- Email: `admin@vialia.com`
- Password: `admin123`

**Change the admin password immediately in production!**

---

## 🌍 Deployment

### MongoDB Atlas
1. Create cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Update `MONGODB_URI` to Atlas connection string
3. Import questions: `node scripts/seed.js` (with updated URI)

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

Set all environment variables in Vercel dashboard.

**Stripe Webhook:** Update to your production URL in Stripe dashboard.

### Render (Keep-Alive)
To prevent the Render free tier from sleeping after 15 minutes of inactivity:
- The app includes an internal "pinger" that calls `/api/keep-alive` every 10 minutes.
- Ensure `NEXT_PUBLIC_APP_URL` is set to your production URL in the Render Environment Variables.
- Render's `RENDER_EXTERNAL_URL` is also supported automatically.

---

## 📝 Question Data Format

Your `gala_exams` MongoDB documents should have (or similar) structure:

```json
{
  "_id": {"$oid": "..."},
  "exam_id": 1,
  "question_number": 5,
  "question": {
    "es": "¿Cuál es la velocidad máxima en autopista?",
    "en": "What is the maximum speed on motorways?"
  },
  "options": [
    {"idx": 0, "text_es": "100 km/h", "text_en": "100 km/h"},
    {"idx": 1, "text_es": "120 km/h", "text_en": "120 km/h"},
    {"idx": 2, "text_es": "130 km/h", "text_en": "130 km/h"}
  ],
  "correct_option_idx": 2,
  "metadata": {
    "image_url": null,
    "help_html": "<p><strong>Artículo 48:</strong> ...</p>"
  }
}
```

The seed script normalizes many common field name variations automatically.

---

## 📄 License

MIT — Build something great! ✨
