# Omni Haven Stock Book

A phone app for Omni Haven's stock. It tracks cartons from the warehouse to the agents to customers, so the warehouse count, the agents' books and the Omni system can be checked against each other.

- **Frank (warehouse)** records cartons given to agents, returns, stock from Multipro, and weekly counts.
- **Peter and Deborah (agents)** confirm deliveries and record credit sales, customer payments and orders raised in Omni.
- **Nana (manager)** sees everything, settles disputes, and gets a Monday summary by email.

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
1. Copy `src/Code.gs` and `src/Index.html` into Apps Script, over the old files, then click **Save**.
2. Go to **Deploy > Manage deployments**, click the pencil, choose **New version**, and click **Deploy**.

The link, the codes and the data all stay the same.
