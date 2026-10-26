<!--
  The privacy policy. Reviewed 2026-10-26 against what the app actually does
  now: passwords, push notifications, pick-up games, titles, table bookings,
  club requests, event tickets, the map and address lookups, and the
  services it runs on had all arrived since it was last written. Reachable
  from the Me menu and the account menu, not only the landing page.
-->
<h1 class="page-title">Privacy</h1>
<p class="updated">Updated 26 October 2026</p>

<div class="policy">
    <p class="lead">
        Call to Arms runs sign-ups, pairings and leagues for tabletop wargaming clubs. This is
        what it keeps about you, why, and who sees it, in plain words. It is a small hobby
        project and this isn’t legal advice.
    </p>

    <section>
        <h2>Signing in</h2>
        <ul>
            <li><b>Discord</b>: your Discord ID, name and picture.</li>
            <li><b>Google</b>: your Google ID, name, email, whether Google has checked it, and picture. The email is never shown to other members.</li>
            <li><b>Email link</b>: your address and when each link was sent and used, with a scrambled form of your IP address to stop too many links being sent. A link stops working after 15 minutes.</li>
            <li><b>Password</b>, if you set one: only a scrambled form that can’t be turned back. To refuse passwords known from data breaches, the first five characters of another scrambled form are checked against a public list (Have I Been Pwned). Your password itself never leaves the app.</li>
            <li><b>Your name</b>: the one you choose for your account. Club admins see it beside your sign-in name.</li>
        </ul>
        <p>One cookie keeps you signed in. It holds no personal details, lasts 30 days, and renews while you use the app. Signing out everywhere ends it on every device.</p>
    </section>

    <section>
        <h2>Playing</h2>
        <ul>
            <li><b>Your player profile</b> at each club: name, faction, and any titles the club gives you.</li>
            <li><b>Sign-ups and games</b>: the nights you sign up for, your army details, arrival time, your pairings, and league results with rating changes. This is the record the app exists to keep. Experience and levels are worked out from it.</li>
            <li><b>Pick-up games</b>: when and where you’re free, and anything you add. Other members of your club see your request. If you decline a match, your reason goes to your club’s admins only, never to the other player.</li>
            <li><b>Event entries</b>, if your club runs events: your entry and results. If tickets are paid for, Stripe takes the payment. We never see your card details.</li>
            <li><b>Table bookings</b>, at clubs that take them: the name, email or phone and note you give, so the venue can reach you.</li>
            <li><b>Club requests</b>: if you ask for your club to be added, your name, email, role and the club details you send.</li>
        </ul>
    </section>

    <section>
        <h2>Notifications</h2>
        <p>If you turn them on, we keep your device’s push address, the name of its browser, and which kinds you’ve turned off. Your browser’s maker (Google, Apple or Mozilla) delivers each one. Turning them off deletes the address.</p>
    </section>

    <section>
        <h2>Maps and location</h2>
        <p><b>Near me</b> on the Clubs page works out distances in your browser. Your location is never sent to us. Map tiles come from OpenFreeMap. Club addresses are looked up with postcodes.io and Photon (OpenStreetMap) to place pins. None of these receive anything about you beyond what any website sees when your browser asks it for something.</p>
    </section>

    <section>
        <h2>Who sees what</h2>
        <p>Members of your club see what a paper sign-up sheet would show: names, sign-ups, pairings, league records, titles. Your club’s admins can also see and correct sign-ups and pairings, and admin actions are logged. Members of other clubs can’t see your club’s data.</p>
        <p>If your club has connected Discord, sign-ups, pairings, pick-up games, results and achievements may be posted to your club’s own channels.</p>
    </section>

    <section>
        <h2>Where it lives</h2>
        <p>The website is served by Vercel, the app by Fly.io, and the data and uploaded images are stored with Supabase. Emails are sent through Resend. We use no analytics, tracking or advertising, and never sell or share your information.</p>
        <p>Your browser also stores a note of whether you’ve dismissed a banner or the notifications prompt. That never leaves your device.</p>
    </section>

    <section>
        <h2>Your data</h2>
        <p>To see what’s kept about you, correct it, or have it removed, ask your club’s admins, who can pass it on to us.</p>
    </section>
</div>

<style>
    .page-title {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        margin: 0 0 0.4rem;
    }
    @media (max-width: 560px) { .page-title { font-size: 2.1rem; } }

    .updated {
        margin: 0 0 1.4rem;
        font-family: var(--font-heading);
        font-size: 0.9rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--color-text-faint);
    }

    .policy { max-width: 68ch; line-height: 1.6; color: var(--color-text-muted); }
    .lead { margin: 0 0 1.2rem; font-size: 1.05rem; color: var(--color-text-base); }

    section {
        padding: 1.1rem 1.25rem 0.4rem;
        margin-bottom: 12px;
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
    }
    h2 {
        margin: 0 0 0.6rem;
        font-family: var(--font-heading);
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--color-accent);
    }
    p { margin: 0 0 0.8rem; }
    ul { margin: 0 0 0.8rem; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.45rem; }
    b { color: var(--color-text-bright); }
</style>
