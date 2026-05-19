# AI Email Agent

An intelligent email management agent that reads Gmail inbox, 
classifies emails by priority, and suggests responses using Claude AI.

## Features
- Gmail OAuth2 authentication
- Automatic email classification (high / medium / low priority)
- Category detection (work, financial, personal, spam)
- AI-generated reply drafts via Claude Haiku
- Real-time dashboard with auto-refresh loop

## Tech Stack
- Python 3.11
- Anthropic Claude API
- Gmail API (Google Cloud)
- Streamlit
- google-auth-oauthlib

## Setup
1. Clone the repo
2. Create a virtual environment: `python -m venv .venv`
3. Install dependencies: `pip install -r requirements.txt`
4. Add your API keys to `.env`
5. Run: `streamlit run dashboard.py`
