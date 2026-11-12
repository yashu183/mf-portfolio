# Vesta

A private portfolio tracker for mutual funds, fixed deposits, gold, silver and EPF, with AI SIP recommendations from Claude on AWS Bedrock.

## Features

- **Five asset classes, one dashboard**: mutual funds at today's NAV, fixed deposits across their renewal cycles, gold and silver at live prices, and EPF with its contribution history.
- **Overview**: total balance, gain and return across every asset, an allocation donut (current value, invested or returns), and invested-vs-current charts.
- **Mutual funds**: returns, XIRR and status for each fund, grouped by performance; allocation by SIP against Claude's target; a month-by-month investment timeline with SIP revisions.
- **AI recommendations**: a revised monthly SIP plan with reasons, plus suggested funds to add (Claude Sonnet on AWS Bedrock).
- **Gold and silver**: holdings grouped into sets, with average buy price per set against the live price, per-gram and overall profit or loss, and how long each holding has been held.
- **Fixed deposits**: every cycle of each deposit, matured or in progress, with interest earned and maturity value.
- **EPF**: accounts, contributed vs interest, and each change in monthly contribution.
- **Hide amounts**: one switch masks every rupee figure in the app (cards, lists, tooltips, chart axes); percentages stay visible. Remembered on the device.
- **Light and dark themes**: follows the OS until you pick one; the choice is remembered.
- **Private by default**: a six-digit access code guards the portfolio; a public landing page sits in front of it.
- **Responsive**: a fixed sidebar from 1024px; a menu bar and slide-in drawer on phones and tablets.

## Tech stack

### Frontend
- React 18 and React Router 6, built with Vite
- Tailwind CSS 4, with the light and dark themes as CSS variables
- Recharts for charts, Lucide for icons
- Geist and Geist Mono

The design follows Vercel's design system: hairline cards, mono labels, a dashboard sidebar and in-column scrolling.

### Backend
- Node.js 18+ and Express
- AWS Bedrock (Claude Sonnet 4) for recommendations
- [MFapi](https://api.mfapi.in/mf) for mutual fund NAVs
- [bullions.co.in](https://bullions.co.in/) for gold (24K) and silver (999) prices

## Prerequisites

- Node.js 18 or higher, and npm
- An AWS account with Bedrock access (only for AI recommendations)

## Installation

```bash
git clone <repository-url>
cd mf-portfolio
npm --prefix server install
npm --prefix client install
```

## Configuration

### 1. Environment

Copy `server/.env.example` to `server/.env` and fill it in:

```env
AUTH_ACCESS_CODE=      # your six-digit code (leading zeroes are fine)
PORT=3002
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
NODE_ENV=development
AWS_REGION=us-east-1   # optional, for recommendations
```

Optional: `NAV_CACHE_DURATION_MS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, and AWS keys (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) if you don't use an AWS CLI profile.

The frontend calls the API at `http://localhost:3002` by default. Set `VITE_API_URL` when building or running the client to point it elsewhere.

### 2. Portfolio

Copy the example and replace it with your holdings. `portfolioConfig.json` is git-ignored.

```bash
cp server/portfolioConfig-example.json server/portfolioConfig.json
```

The file has one list per asset, plus the AI settings:

```json
{
  "funds": [
    {
      "id": 1,
      "name": "Nippon India Growth Mid Cap Fund",
      "shortName": "Nippon Growth Mid Cap",
      "category": "Mid Cap",
      "schemeId": "100377",
      "lumpsums": [{ "amount": 2000, "date": "2023-02-13" }],
      "sips": [{ "amount": 2000, "startDate": "2023-04-05", "stopDate": null }],
      "color": "#FFFFD2"
    }
  ],
  "fixedDeposits": [
    {
      "id": 1,
      "name": "Holder Name",
      "bank": "Bank Name",
      "label": "2L - 444 d",
      "principal": 200000,
      "startDate": "2025-01-18",
      "cycles": [
        { "termDays": 444, "rate": 7.25, "maturityDate": "2026-04-07", "interestBank": 18271 }
      ]
    }
  ],
  "gold": [
    { "id": 1, "label": "SGB 2024-I", "set": "SGB 2024", "purchaseDate": "2024-02-05", "quantity": 10, "purchasePrice": 6200 }
  ],
  "silver": [
    { "id": 1, "label": "Silver Coins", "set": "Coins 2023", "purchaseDate": "2023-08-15", "quantity": 500, "purchasePrice": 72 }
  ],
  "epf": [
    {
      "id": 1,
      "label": "Current Employer",
      "startDate": "2021-09-01",
      "monthlyContribution": 3600,
      "employeeContribution": 1800,
      "employerContribution": 1800,
      "contributionHistory": [
        { "from": "2026-09", "employeeContribution": 3000, "employerContribution": 3000 }
      ]
    }
  ],
  "llmConfig": {
    "enabled": true,
    "model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "max_tokens": 4000,
    "cacheValidityHours": 24,
    "temperature": 0.3,
    "apiKeyRequired": true
  }
}
```

**Mutual funds**
- `schemeId`: the scheme code from [MFapi](https://api.mfapi.in/mf). Search for your fund there and copy its code, e.g. HDFC ELSS Tax Saver Growth is `101979`.
- `sips`: `amount`, `startDate` and `stopDate` (YYYY-MM-DD; `null` while active). Add a new entry when the SIP amount changes; each one shows as a revision on the timeline.
- `lumpsums`: `amount` and `date`.
- `color`: the fund's dot colour in lists.

**Fixed deposits**
- `cycles`: one entry per term, renewals included, with `termDays`, `rate` (% p.a.), `maturityDate` and the bank's stated `interestBank`.

**Gold and silver**
- `quantity` in grams and `purchasePrice` per gram.
- `set` groups holdings, e.g. one purchase spread over several days, for the per-set average-price chart.

**EPF**
- `contributionHistory`: each change to the monthly contribution, from the month (YYYY-MM) it applies.

**AI** (`llmConfig`)
- `enabled`: turns recommendations on or off.
- `model`: the Bedrock model ID.
- `max_tokens`, `temperature`: response length and variability.
- `cacheValidityHours`: how long a set of recommendations is reused.

### 3. AWS Bedrock (optional)

Run `aws configure`, or set the AWS keys in `server/.env`, and check that the model in `llmConfig.model` is enabled for your region. Everything except recommendations works without it.

## Running

### Development

```bash
npm --prefix server start   # API on http://localhost:3002 (npm --prefix server run dev reloads on change)
npm --prefix client run dev # app on http://localhost:3000
```

Open http://localhost:3000. Without a session you land on the public page at `/welcome`; **Open your portfolio** goes to `/unlock` for the access code.

### Production

```bash
npm --prefix client run build   # outputs client/dist
```

Serve `client/dist` as a single-page app (every route falls back to `index.html`) and run the API with `NODE_ENV=production`. `server/mf-portfolio.service` is a systemd unit for the API.

## Access

- The code is checked by the API only. Never put it in a `VITE_` variable or commit it. Restart the API after changing it.
- A missing or invalid code denies access; it never turns authentication off.
- A session lasts one hour in an HttpOnly cookie and ends when the API restarts. Reloading inside a session keeps you signed in.
- **Lock** (bottom of the sidebar, or in the phone menu) ends the session on the server at once, clears cached data and returns to the landing page.
- Signed in, `/welcome` and `/unlock` go straight to Overview; signed out, every app page goes to `/welcome`.
- Attempts are limited to 10 per IP every 15 minutes.
- It's a shared PIN, not an emailed one-time code.

In production use HTTPS and set `ALLOWED_ORIGINS` to the frontend's origin. Serve the frontend and API from the same site (ideally proxy `/api` under the frontend), since the cookie is `SameSite=Strict`. Behind a reverse proxy, set Express's trusted-proxy setting so the per-IP limit sees real client addresses.

## Using the app

| Page | What it shows |
| --- | --- |
| **Overview** | Total balance, gain and return; each asset's value and share; allocation donut; invested vs current per asset |
| **Mutual Funds → Dashboard** | Every fund as a list or grid, with search and filters (category, status, SIP or lump sum); top performer, funds needing attention, category split |
| **Mutual Funds → Performance** | Funds grouped as Excellent, Good, Monitor and Underperforming |
| **Mutual Funds → Allocation** | Monthly SIP by category, current vs Claude's target |
| **Mutual Funds → Recommendations** | Claude's revised SIP plan with reasons, and funds to add (SIP funds only) |
| **Mutual Funds → Timeline** | Monthly SIP and lump-sum investments, SIP commitment over time, every SIP revision |
| **Gold / Silver** | Live price, sets against the live price, every holding with how long it has been held |
| **FDs** | Each deposit's cycles, progress, interest and value at maturity; filter by holder |
| **EPF** | Each account's balance, contributed vs interest, and contribution history |

The foot of the sidebar (or the phone menu) holds the theme switch, **Hide amounts** and **Lock**.

## API

Every route except `/api/health`, `/api/auth/verify` and `/api/auth/logout` needs a session.

| Method | Route | Returns |
| --- | --- | --- |
| `POST` | `/api/auth/verify` | Checks the access code and starts a session |
| `GET` | `/api/auth/session` | Whether the current session is active |
| `POST` | `/api/auth/logout` | Ends the session and clears the cookie |
| `GET` | `/api/health` | Service health |
| `GET` | `/api/portfolio/overview` | Totals across all assets |
| `GET` | `/api/portfolio/funds` | Mutual funds with NAV, returns and XIRR |
| `GET` | `/api/portfolio/complete` | Funds with full calculations |
| `GET` | `/api/portfolio/investment-timeline` | Month-by-month investments |
| `GET` | `/api/portfolio/fds` | Fixed deposits and their cycles |
| `GET` | `/api/portfolio/gold` | Gold holdings at the live price |
| `GET` | `/api/portfolio/silver` | Silver holdings at the live price |
| `GET` | `/api/portfolio/epf` | EPF accounts |
| `POST` | `/api/recommendations` | Claude's SIP recommendations |

## Tests

```bash
npm --prefix server test        # authentication regression tests
npm --prefix client run build   # frontend build check
```

## Troubleshooting

**Recommendations fail**
- Check that your AWS credentials have Bedrock access and that the model ID is enabled in your region.
- "The security token included in the request is invalid" means the AWS credentials are missing or expired.

**NAV not updating**
- Check the scheme IDs against [MFapi](https://api.mfapi.in/mf) and that the API is reachable.

**Gold or silver shows offline**
- Prices are read from bullions.co.in; if the site is down or changes its layout, the live price can't be parsed.

**Can't sign in**
- Check `AUTH_ACCESS_CODE` in `server/.env` and that the frontend's origin is in `ALLOWED_ORIGINS`.
- After 10 wrong attempts, wait 15 minutes.

**Build errors**
- Reinstall dependencies (`rm -rf node_modules && npm install`) and check you're on Node 18 or newer.

## License

MIT

## Author

Developed by Yashwanth C

---

**Note**: Vesta is for personal tracking and information only. AI-generated recommendations are not financial advice; consult a qualified financial adviser before making investment decisions.
