# Crew offline: test on a real phone

About 20 minutes. The automated run (headless Edge, production build) already checks the app's logic. This
list is for what only a real phone shows: camera, GPS, airplane mode, the installed app, and iPhone storage.

**You need:** the live site deployed with this version, one crew account, one office account on a computer,
and one job assigned to that crew member **for today**, with a design and a site pin.

Tick each box. If one fails, write down what the screen said.

## 1. Before going out (with signal)

- [ ] Sign in as the crew member and **install the app** (Me tab → Install, or Add to Home Screen on iPhone).
- [ ] Open the app from the home-screen icon (not the browser).
- [ ] Open the job. Under the 3D / Work order buttons it says **"Saved for offline: … open without signal"**
      within about a minute. If it says "Not all saved", tap **Try again** and note what was missing.

## 2. No signal (airplane mode ON)

- [ ] Close the app completely, then open it from the icon. It opens, and shows
      **"Showing what was saved at …"**.
- [ ] Open the job. Tap **3D**: real plants appear (palms, shrubs), not grey stand-in shapes.
- [ ] Tap **Work order**: the PDF opens, with the message "opened the work order saved on this phone".
- [ ] Before clocking in, tap **I'm on my way** → 30 min. It offers a **text message** instead, with the
      message filled in. Tap **Text …**: your messages app opens with it (the customer's number in the To field).
      Send it to check that it arrives. Back in the app the card says "Texted at …".
- [ ] Tap **Continue job / Start job (clock in)**. Location turns on and it says the start is saved for when
      there's signal.
- [ ] On one stage, **Take photo & finish** with the real camera. The stage shows
      "Photo saved on this phone".
- [ ] On a stage that's already done, tap **Undo**: "Undo saved on this phone". Then take its photo again.
- [ ] Finish every stage with a photo. **Submit for sign-off** is offered, with "… photos are still on this
      phone: the sign-off goes after them". Submit: the card says **"Submitted on this phone"**.
- [ ] **Report a problem** → pick a reason → Tell the office. It says the report is saved.
- [ ] The top bar shows the waiting actions (Jobs tab badge).
- [ ] Wait **5 minutes** with the app closed, then open it again: the waiting actions are still there.
- [ ] **Office computer (meanwhile):** Overview → **Crew phones**. Before you went offline it listed nothing
      wrong for this crew member. Now it may say they haven't been in touch for a while (after 1 hour on a job).
- [ ] **Office computer (meanwhile):** move one of this crew member's *other* jobs to a new date, and cancel another.

## 3. Signal back (airplane mode OFF)

- [ ] Open the app. Within about 30 seconds: "Sent 3 saved actions" (or similar), and the waiting badge is gone.
- [ ] **Office computer:** the job shows the clock-in at the time you tapped it (not the time it was sent),
      the stage photos, every stage done, the problem report, and the job **waiting for sign-off**.
- [ ] Nothing appears twice (one clock-in, one photo, one report).
- [ ] **On the phone:** a blue **"Changed since you last checked"** card lists the moved job (new and old date) and
      the cancelled one. Dismiss them; they stay gone after reopening the app.
- [ ] **Office computer:** Crew phones says every crew phone has sent its work (refresh after a minute).

## 4. Weak signal (optional, worth it)

- [ ] Walk to a spot with one bar. Take a stage photo. Either it uploads, or it waits and sends later. It must
      never disappear or appear twice.

## 5. Sign out

- [ ] Me → Sign out. Sign in as a different crew member on the same phone: none of the first person's jobs,
      photos or work orders are there, even in airplane mode.

## 6. iPhone only

- [ ] Push alerts: in the office, assign a new job to this crew member while the app is closed. An alert arrives.
- [ ] Leave the app unused for 3+ days, then open it in airplane mode. iPhones may clear a web app's saved
      data after about a week without use. Note whether the jobs are still there.

## If something fails

Note the step, the phone model and browser, and what the screen said. A screenshot helps most.
