# Omni Haven Stock Book: setup and process

This is everything you need, from an empty Google Drive to the daily routine. The app runs inside your Google Sheet and Google account. GitHub keeps the code and, once set up, sends updates to the app by itself.

## Part 1: One-time setup (Nana, on a laptop, about 15 minutes)

Sign in to the Google account you want for Omni Haven. Emails will be sent from this account's Gmail.

### 1. Create the Sheet
1. Go to drive.google.com, then **New > File upload**, and pick `Omni Haven Stock Book.xlsx` (Claude provides it separately; it is not kept on GitHub because it holds the access codes).
2. Open it, then choose **File > Save as Google Sheets**. Use only the Google Sheets copy from now on, and delete the .xlsx so you don't mix them up.
3. Check the tabs:
   - **Entries** holds the October opening stock (5 rows, 1,027 cartons) and nothing else.
   - **Codes** has a 6-digit code each for Nana, Frank, Peter and Deborah. You can change any code.
   - In **Codes** column D, type each person's Gmail address. Leave a cell blank if that person shouldn't get emails.

### 2. Add the app code
1. In the Sheet, choose **Extensions > Apps Script**.
2. Delete everything in `Code.gs`, then paste in the contents of `src/Code.gs`.
3. Click **+ > HTML**, name the file `Index` (no extension), and paste in the contents of `src/Index.html`.
4. Click **Save** (the disk icon).

### 3. Publish it
1. Click **Deploy > New deployment**, then the gear icon, and choose **Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy**.
3. Click **Authorize access** and pick your account. Then click **Advanced > Go to Omni Haven Stock Book (unsafe)**, then **Allow**. Google asks for permission to edit your Sheets and send email as you. The warning appears because this is your own script, not a published one.
4. Copy the **Web app URL** (it ends in `/exec`).

### 4. Turn on the Monday summary email
1. In Apps Script, open **Project Settings** (the gear on the left) and set the time zone to **(GMT+00:00) Accra**, so emails go out on Ghana time.
2. Back in the editor, pick **setupWeeklyEmail** from the function menu at the top, then click **Run**.
3. Approve the permission prompt if one appears.
4. You get a summary email straight away, then another every Monday at about 7 am.

### 5. Hand it out
Send each person the link and **their own** code, privately, by SMS or WhatsApp. On their phone, they open the link, enter the code, and choose **Add to Home screen** so it opens like an app.

If you used the old app, archive it: **Deploy > Manage deployments > Archive**, in the old Sheet. The Claude Stock Book link is separate, and nobody should use it any more.

## Part 2: The daily routine

Only Frank and Nana enter things. Peter, Deborah and Musah open the app to **view** their own book (what they have taken, what has been raised in Omni, and what is still with them) and to **confirm** each delivery Frank records.

| Who | When | What they do in the app |
|---|---|---|
| Frank | Every time cartons leave | **Give cartons to an agent**: pick the agent, then add every product and how many cartons. The agent gets an email. |
| Agent | Same day | Open the app and tap **That's right** on each delivery, or **That's wrong** and enter the number they actually took. |
| Frank | When cartons come back | **Agent returned cartons**. |
| Frank | When the Multipro truck arrives | **Received from supplier**, with the invoice or waybill number. |
| Nana | Daily, from the Omni app | **Raised in Omni** (on the Overview, or on an agent's page): pick the agent, add every product and cartons raised, and the Omni order number if you want. The app refuses more than the agent holds. |
| Nana (optional) | When you want to track a customer who owes | On the agent's page: **Gave cartons on credit**, then **Customer paid** when they pay. |
| Frank | Every Saturday, after the last carton goes out | **Count the warehouse** for each product, and type in what the Omni app shows. |
| Nana | Monday | Read the summary email. Open the app and check that "Last check" reads **Matches** for every product. |

Past entries are on the **Entries** tab of each page. The **By date** tab shows a table of cartons taken (or raised, or returned) per agent per day, with From and To dates to filter.

The rule that keeps the books balanced: **cartons taken = raised in Omni + returned + still with the agent**.

## Part 3: When Frank and an agent disagree

1. **The agent flags it.** On the delivery, the agent taps **That's wrong** and enters the number they actually took, plus a short note. Nana and Frank get an email.
2. **Frank checks first.** He looks at the shelf and his paperwork. If he agrees, he taps **[Agent] is right** on his page. The figure is corrected and everyone is emailed. Frank can only accept the agent's number.
3. **If Frank doesn't agree, Nana decides.** On her page under **Disputed deliveries**, she taps **Keep** (Frank's number), **Use** (the agent's number), or **Other number** with a reason, after checking the waybill, what the agent still has, and Frank's next count.
4. **Everyone is told.** The result is saved on the entry, for example "Changed from 10 to 8 by Frank (agreed with Deborah)". A settled delivery can't be disputed again.

Frank's page and Nana's page list every delivery still **waiting for the agent to confirm**.

## Part 4: Access and security
- Peter and Deborah each see only their own book, and can only view it and confirm deliveries. Neither can see the other's cartons, credit or customers.
- Frank sees warehouse stock and deliveries, but not customers' credit.
- Nana sees everything, can open anyone's page, and is the only one who can add products or agents.
- **To lock someone out**, change their code on the Codes tab. The old code stops working at once.
- **To add an agent**, use **Add or retire an agent** on Nana's page. A new code appears on the Codes tab. Add their email in column D.
- Only Nana or the person who made an entry can delete it.

## Part 5: Start of each month
To start fresh, open your page and tap **Clear all entries** under **Start fresh**, then type CLEAR. Every entry is removed for everyone, but a full copy is kept first on a new **Backup** tab in the Sheet. Products, agents and codes stay. Then have Frank record the new opening stock with **Count the warehouse**.

## Changing the app later: automatic updates from GitHub
After this one-time setup, every change merged on GitHub goes live by itself. The link, the codes and the data stay the same. Do it on a laptop, after Part 1 is done.

1. **Allow outside updates.** Go to script.google.com/home/usersettings, signed in with the Omni Haven account, and switch **Google Apps Script API** to **On**.
2. **Copy the Script ID.** In Apps Script, open **Project Settings** (the gear on the left). Copy the **Script ID**.
3. **Copy the Deployment ID.** Click **Deploy > Manage deployments**, select the web app, and copy its **Deployment ID** (a long code, not the /exec link).
4. **Sign in once from the laptop.**
   - Install Node.js (the LTS version) from nodejs.org.
   - Open Terminal (Mac) or Command Prompt (Windows) and type `npx @google/clasp@2.4.2 login`, then press Enter.
   - A browser opens. Pick the Omni Haven account and click **Allow**.
   - This creates a file called `.clasprc.json` in your home folder (`C:\Users\<your name>` on Windows, your user folder on a Mac). Open it with Notepad or TextEdit and copy everything in it.
   - Treat this file like a password. It lets the updater into your Apps Script. Don't send it to anyone, Claude included.
5. **Give GitHub the three values.** In the repository on GitHub, open **Settings > Secrets and variables > Actions** and click **New repository secret** three times:
   - `CLASPRC_JSON`: everything you copied from `.clasprc.json`
   - `SCRIPT_ID`: the Script ID
   - `DEPLOYMENT_ID`: the Deployment ID
6. **Test it.** Open the **Actions** tab, click **Deploy to Apps Script**, then **Run workflow**. A green tick means the live app is up to date.

From then on:
- Don't edit code in the Apps Script editor. The next update from GitHub overwrites it.
- If a run turns red, open it to see which step failed. A failed test stops the update, so the live app keeps running the last good version.
- If you change your Google password or remove access, repeat step 4 and replace `CLASPRC_JSON`.

To update by hand instead: paste in the new code and click **Save**. Then go to **Deploy > Manage deployments**, click the pencil, set **Version: New version**, and click **Deploy**.

## WhatsApp messages to agents

After Frank (or Nana) saves cartons given to an agent, the app shows a **Send on WhatsApp** button. Tapping it opens WhatsApp on that phone with the message already typed to the agent, saying what was given and asking them to confirm. Press send. It is free and uses your own WhatsApp.

To set it up, open the Codes tab of the Sheet and type each agent's number in the **WhatsApp** column (the app adds that column the first time Nana opens it), for example 0241234567. If an agent hasn't confirmed yet, Frank and Nana can also tap **Remind on WhatsApp** under "Waiting for the agent to confirm". When an agent taps **That's wrong** and sends their number, they get a **Tell Nana on WhatsApp** button so Nana hears about it straight away and can settle it.

## If entries don't show up in the Sheet
Every saved entry goes to the **Entries** tab of the Sheet you opened Apps Script from. Nana's page shows that Sheet's name and a link at the bottom.
- Make sure everyone uses the `/exec` link, not the Claude link.
- Open the Sheet from the link on Nana's page, not an older copy or the .xlsx.
