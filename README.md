# Mutual Fund Portfolio Tracker

A real-time mutual fund portfolio tracking application with AI-powered investment recommendations powered by AWS Bedrock Claude.

## Features

- 📊 **Real-time Portfolio Tracking** - Track multiple mutual funds with live NAV updates
- 💰 **Investment Analytics** - View returns, XIRR, and performance metrics
- 🎯 **AI-Powered Recommendations** - Get personalized investment advice using AWS Bedrock Claude
- 📈 **Performance Monitoring** - Track fund performance across categories
- 🗓️ **Investment Timeline** - Visualize your investment journey
- 🔍 **Smart Filters** - Filter recommendations by search and category (SIP-only funds)
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices

## Tech Stack

### Frontend
- React.js
- Tailwind CSS
- Lucide React (Icons)

### Backend
- Node.js
- Express.js
- AWS Bedrock (Claude Sonnet 4)
- Mutual Fund API (https://api.mfapi.in/mf)

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- AWS Account with Bedrock access (for AI recommendations)
- AWS CLI configured with appropriate credentials

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mf_portfolio
   ```

2. **Install dependencies**

   Backend:
   ```bash
   cd server
   npm install
   ```

   Frontend:
   ```bash
   cd client
   npm install
   ```

## Configuration

### Step 1: Set up Portfolio Configuration

1. Navigate to the server directory
2. Copy the example configuration file:
   ```bash
   cp portfolioConfig-example.json portfolioConfig.json
   ```

3. Edit `portfolioConfig.json` with your mutual fund investments

### Step 2: Configure Your Funds

The configuration file structure:

```json
{
  "funds": [
    {
      "id": 1,
      "name": "Fund Name",
      "shortName": "Short Name",
      "category": "Category (ELSS, Large Cap, Mid Cap, etc.)",
      "schemeId": "SCHEME_ID",
      "lumpsums": [
        { "amount": 10000, "date": "2024-01-15" }
      ],
      "sips": [
        { "amount": 5000, "startDate": "2024-01-05", "stopDate": null }
      ],
      "color": "#hex-color"
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

### Finding Scheme IDs

All scheme IDs are sourced from the Mutual Fund API: **https://api.mfapi.in/mf**

To find a scheme ID:
1. Visit https://api.mfapi.in/mf
2. Search for your mutual fund
3. Copy the scheme ID from the results

Example:
- HDFC ELSS Tax Saver - Growth Plan: `101979`
- ICICI Pru Bluechip Fund Regular: `100218`

### Step 3: AWS Bedrock Configuration

1. Ensure you have AWS CLI configured:
   ```bash
   aws configure
   ```

2. Verify Bedrock access in your AWS region (default: us-east-1)

3. The application uses AWS Bedrock Claude Sonnet 4 by default. You can modify the model in `portfolioConfig.json` under `llmConfig.model`

### Step 4: Environment Variables (Optional)

Create a `.env` file in the server directory if you need custom configurations:
```env
PORT=5001
AWS_REGION=us-east-1
```

## Running the Application

### Development Mode

1. **Start the backend server**
   ```bash
   cd server
   npm start
   ```
   Server will run on http://localhost:5001

2. **Start the frontend** (in a new terminal)
   ```bash
   cd client
   npm start
   ```
   Frontend will run on http://localhost:3000

### Production Build

1. Build the frontend:
   ```bash
   cd client
   npm run build
   ```

2. The backend serves the built frontend from the `client/build` directory

## Usage

### Dashboard
- View all your mutual funds with current values
- See overall portfolio performance
- Monitor category-wise breakdown

### Performance
- Track fund performance by status (Excellent, Good, Monitor, Poor)
- View detailed metrics for each fund

### Allocation
- Visualize asset allocation across categories
- See recommended vs current allocation

### Recommendations (AI-Powered)
- Get personalized SIP adjustment recommendations
- Filter by search and category
- View AI-suggested new investments
- See revised monthly SIP plans with reasoning

### Timeline
- Visualize your investment journey over time
- Track SIP contributions and lumpsum investments

## Configuration Options

### SIP Configuration
- **amount**: Monthly SIP amount
- **startDate**: SIP start date (YYYY-MM-DD)
- **stopDate**: SIP stop date (null for active SIPs) (YYYY-MM-DD)

### Lumpsum Configuration
- **amount**: Investment amount
- **date**: Investment date (YYYY-MM-DD)

### AI Configuration
- **enabled**: Enable/disable AI recommendations
- **model**: AWS Bedrock model ID
- **max_tokens**: Maximum tokens for AI responses
- **cacheValidityHours**: How long to cache recommendations
- **temperature**: AI creativity level (0.0-1.0)

## API Endpoints

### Portfolio
- `GET /api/portfolio/complete` - Get complete portfolio with calculations
- `GET /api/portfolio/timeline` - Get investment timeline data

### Health
- `GET /api/health` - Check service health

### Recommendations
- `POST /api/recommendations` - Generate AI-powered recommendations

## Troubleshooting

### AWS Bedrock Errors
- Ensure your AWS credentials have Bedrock access
- Verify the model ID is correct for your region
- Check if the model supports on-demand throughput

### NAV Not Updating
- Verify internet connection
- Check if the mutual fund API is accessible
- Ensure scheme IDs are correct

### Build Errors
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version compatibility

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Author

Developed by Yashwanth C

---

**Note**: This application is for informational purposes only. AI-generated recommendations do not constitute financial advice. Please consult with a qualified financial advisor before making investment decisions.
