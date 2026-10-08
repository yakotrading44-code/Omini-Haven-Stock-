# Omni Haven Stock Book

A phone app for Omni Haven's stock. It tracks cartons from the warehouse to the agents to customers, so the warehouse count, the agents' books and the Omni system can be checked against each other.

- **Frank (warehouse)** records cartons given to agents, returns, stock from Multipro, and weekly counts.
- **Peter, Deborah and Musah (agents)** view their own book (cartons taken, raised in Omni, still with them) and confirm or dispute each delivery.
- **Nana (manager)** records orders raised in Omni, sees everything, and gets a Monday summary by email.

Everyone opens the same link with their own code, and each person sees only their own book.

## How it runs
The app runs on Google, not on GitHub. This repository keeps the code and its history.

| Where | What lives there |
|---|---|
| Google Sheet (Nana's Drive) | All entries, everyone's codes (Codes tab), settings |
| Apps Script, inside that Sheet | `src/Code.gs` and `src/Index.html`, published as the web app |
| Gmail (Nana's account) | Delivery, dispute and weekly summary emails |
| This repository | The code, the setup guide and tests |

The Sheet is never stored here, because it holds the access codes.

## Files
- `src/Code.gs`: server side. It checks codes and decides who may see and record what. It stops stock going negative and sends emails.
- `src/Index.html`: the app people use on their phones.
- `src/appsscript.json`: Apps Script project settings (Ghana time zone, web app access).
- `docs/SETUP.md`: setup and the daily process, step by step.
- `tests/`: checks the server rules against a pretend Sheet. Run them with `node tests/server.test.js`.

## Updating the live app
Every change merged into `main` goes live by itself. The **Deploy to Apps Script** action (`.github/workflows/deploy.yml`) runs the tests, sends `src/` to Apps Script, and updates the existing web app, so the link, the codes and the data all stay the same.

It needs three repository secrets, set once: `CLASPRC_JSON`, `SCRIPT_ID` and `DEPLOYMENT_ID`. The steps are in `docs/SETUP.md` under "Automatic updates from GitHub". Until they are set, the action only runs the tests.

Don't edit code in the Apps Script editor. The next update from GitHub overwrites it.
