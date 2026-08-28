/**
 * What the two in-app handbooks say.
 *
 * Content lives here rather than inside the admin page so the guides can be
 * edited without going near 7,000 lines of admin markup, and so the club and
 * system versions can't drift into different voices.
 *
 * Screenshots are real, taken from a club set up for the purpose. They live in
 * static/help/ and are referenced by name.
 */
import type { Section } from './Handbook.svelte';

/** For a brand-new club super-admin who has just been handed a club. */
export const CLUB_HANDBOOK: Section[] = [
    {
        id: 'systems',
        title: 'Turn on the games you play',
        lede: 'Nothing else works until this is done. A club with no systems enabled has no signup form and no pairings, and every other step here has nowhere to attach itself.',
        blocks: [
            { where: 'Club admin › Systems' },
            { p: 'Tick the games your club actually plays and save. Each one becomes its own world inside the app, with its own signups, its own pairings and its own admins.' },
            { fig: 'fig-systems', caption: 'Ticking a box here is what makes a game appear on your club page and your signup form.' },
            { warn: '<b>Enable only what you run.</b> Every enabled system appears on your club page as something people can sign up for, whether or not anyone is organising it. A system nobody runs looks like a dead club night to a visitor deciding whether to come.' },
            { proof: 'The system picker at the top of this page lists your games, and the Signup page offers them.' }
        ]
    },
    {
        id: 'schedule',
        title: 'Set when each game meets',
        lede: 'Do this for each system before you tell anyone the club exists. The schedule decides which week a signup lands in.',
        blocks: [
            { where: 'pick a system › Game System Config' },
            { fig: 'fig-schedule', caption: 'The anchor date only appears when you choose a fortnightly cadence.' },
            { p: 'Pick the day and whether it runs weekly or fortnightly. Fortnightly asks for an <strong>anchor date</strong>, which is any date a session actually ran. The app counts fortnights from there, so it is what separates a session week from an off week. Once it is right you never touch it again.' },
            { p: 'Start time is optional and only affects how the session reads on your club page calendar.' },
            { warn: '<b>Moving the day later moves more than the day.</b> It changes which week signups land in and what your calendar shows, and it moves the call to arms, because that posts a set number of days before the session.' },
            { proof: 'Your club page calendar shows the session on the right dates.' }
        ]
    },
    {
        id: 'page',
        title: 'Make your club page worth landing on',
        lede: 'This is what a stranger sees when they find you. It is the only page that has to sell anything.',
        blocks: [
            { where: 'Club admin › Club page' },
            { fig: 'fig-clubpage', caption: 'The blurb, logo and Discord invite are the three things the onboarding checklist asks for.' },
            { list: [
                '<strong>A blurb.</strong> Two or three sentences on where you meet and what a first visit is like.',
                '<strong>A logo.</strong> It appears on your club page and on every pairings image posted to Discord.',
                '<strong>A Discord invite.</strong> The front door. Somebody who finds you at 11pm cannot sign up for a session yet, but they can join the server.'
            ] },
            { note: 'Card order is not settable. The carousel is shuffled for every visitor so no one system is permanently first.' },
            { proof: 'Open your club page while logged out. If it tells a stranger what you play, when you meet and how to reach you, it is done.' }
        ]
    },
    {
        id: 'discord',
        title: 'Connect Discord',
        lede: 'Almost everything the app does ends in a Discord post. Skip this and the app still works, but it goes very quiet.',
        blocks: [
            { where: 'Club admin › Discord' },
            { p: 'Two different things get confused here. The <strong>invite link</strong> from the last step is how people join your server. A <strong>webhook</strong> is how the app posts into a channel. You need both, and they are set in different places.' },
            { p: 'Create a webhook in Discord under channel settings, then Integrations, then New Webhook. Copy the URL and paste it into the matching slot.' },
            { fig: 'fig-discord', caption: 'One webhook per kind of message. The per-system ones let each game post to its own channel.' },
            { table: { head: ['Webhook', 'Posts', 'Scope'], rows: [
                ['<strong>Signup</strong>', 'Each person as they sign up, and drop-outs', 'Per system'],
                ['<strong>Pairings</strong>', "The week's matchups, as an image", 'Per system'],
                ['<strong>Call to arms</strong>', 'The message that opens signups', 'Per system'],
                ['<strong>League result</strong>', 'Reported games', 'Club-wide'],
                ['<strong>League rankings</strong>', 'The standings table', 'Club-wide'],
                ['<strong>Achievement</strong>', 'Level-ups and milestones', 'Club-wide']
            ] } },
            { warn: '<b>A webhook URL is a password.</b> Anyone holding it can post into that channel as your club, forever, with no login. If one leaks, delete it in Discord and make a new one. That is the only way to revoke it.' },
            { proof: 'Sign yourself up for this week and watch the post land in the right channel.' }
        ]
    },
    {
        id: 'admins',
        title: 'Hand out admin jobs',
        lede: 'Optional, and the step most worth doing early. Running every system yourself is how a club stalls the first week you are away.',
        blocks: [
            { where: 'Club admin › Admins' },
            { fig: 'fig-admins', caption: 'Admin is granted per game system, so somebody can run one night without getting the keys to the club.' },
            { p: 'Whoever organises your Kill Team night can be given Kill Team and nothing else. They generate and publish its pairings, edit its schedule and write its call to arms. They cannot touch your other games or your club settings.' },
            { note: 'The person has to have logged in at least once before you can appoint them. Accounts come from Discord, so there is nobody to grant it to until they have been through the door.' },
            { proof: 'They log in and see an Admin tab with their system in the picker, and only theirs.' }
        ]
    },
    {
        id: 'week',
        title: 'Run your first week',
        lede: 'Everything above was setup you do once. This is the loop you will run every week.',
        blocks: [
            { where: 'pick a system › Pairings' },
            { p: 'Tell people to sign up, then generate the pairings once signups have settled. The evening before works well. The matcher does the work and gives you a grid you can still edit by hand. Odd numbers produce one bye, which is correct behaviour.' },
            { fig: 'fig-grid', caption: 'The summary line above the grid is worth reading before you publish: it counts rematches, mirror matches and vibe mismatches, and shows the widest gap in arrival times.' },
            { warn: '<b>Generate and publish are different actions.</b> Generating produces a draft only you can see. Publishing is what players get. If you regenerate after publishing, publish again, because players are looking at the old set until you do.' },
            { p: 'When somebody drops out they can do it themselves from the signup page. Their opponent is given a bye and Discord is told. Two players can also swap opponents between themselves. You do not need to regenerate the week for either.' },
            { proof: 'The pairings page shows the week to a logged-out visitor, and the image is in your Discord.' }
        ]
    },
    {
        id: 'roles',
        title: 'Who can do what',
        lede: 'Four levels, deliberately narrow. Somebody running one game night does not need the keys to the club.',
        blocks: [
            { table: { head: ['Role', 'Can', 'Cannot'], rows: [
                ['<strong>Club super-admin</strong><br>you', 'Everything for this club, including systems, club page, Discord, admins, venue and table booking', 'Touch another club'],
                ['<strong>Game-system admin</strong>', 'Everything for their system: pairings, schedule, vibes, call to arms, its Discord and its league', 'Club settings, other systems, appointing admins'],
                ['<strong>Venue staff</strong>', 'The venue diary, bookings, floor plan and club-night tables', 'Anything about games, pairings or players'],
                ['<strong>Player</strong>', 'Sign up, drop out, swap opponents, post call-outs, report results, book a table', 'See any admin screen']
            ] } },
            { note: 'Venue staff is a separate grant from game admin on purpose. A bar manager needs tonight’s table plan and nothing else.' }
        ]
    },
    {
        id: 'more',
        title: 'The rest of it',
        lede: 'None of this is needed to run a club night. Add them when the club asks.',
        blocks: [
            { p: '<strong>Leagues</strong> give a system a ladder, with players reporting their own results and standings posting to Discord. It runs per system, so you can have a competitive Old World league and keep Kill Team purely social.' },
            { p: '<strong>Missions</strong> are a pool of scenarios. When it is on, the call to arms picks one at random each week and attaches its map.' },
            { p: '<strong>Call-outs</strong> are for games outside club night. A player posts that they want a game at a particular time and somebody takes them up on it. There is nothing for you to administer.' },
            { p: '<strong>Venue Admin</strong> is for clubs that own or run their venue. It gives you a floor plan of the room and public table bookings, and once pairings are published it seats every game on a real named table.' },
            { note: 'If you play at somebody else’s venue instead, Table booking emails them a table count each week. Use one or the other.' }
        ]
    }
];

/** For somebody handed one game system to run. */
export const SYSTEM_HANDBOOK: Section[] = [
    {
        id: 'yours',
        title: 'What you have been given',
        lede: 'You run one game system. Everything on the left under THIS SYSTEM is yours; the club settings below it are not.',
        blocks: [
            { p: 'You decide when your game meets, what game types it offers, how its pairings are made, what its call to arms says, and whether it runs a league. You cannot change the club page, appoint admins, or touch another system.' },
            { p: 'If more than one system is yours, the picker at the top of the page switches between them. Every setting on this page applies to the system showing there.' },
            { note: 'If a setting you need is missing, it is a club-level one. Ask your club super-admin.' }
        ]
    },
    {
        id: 'schedule',
        title: 'Set your schedule and game types',
        lede: 'Start here. The schedule decides which week a signup lands in, so it has to be right before anyone signs up.',
        blocks: [
            { where: 'Game System Config' },
            { fig: 'fig-schedule', caption: 'Day, cadence and vibes for your system. The anchor date appears only for a fortnightly cadence.' },
            { p: 'Pick your day and whether you run weekly or fortnightly. Fortnightly needs an <strong>anchor date</strong>, which is any date a session actually ran. Fortnights are counted from there, so it decides which of the two weeks is yours.' },
            { p: 'Vibes are the game types players pick between, and the matcher tries to pair like with like.' },
            { table: { head: ['Vibe', 'What a player is telling you'], rows: [
                ['<strong>Casual</strong>', 'Here for a game and a chat, not counting points.'],
                ['<strong>Competitive</strong>', 'Wants a sharp game against someone playing to win.'],
                ['<strong>Standard</strong>', "The single middle option, for systems that don't split casual from competitive."],
                ['<strong>Intro</strong>', 'New to the game and wants teaching.'],
                ['<strong>Open</strong>', 'Happy with any of the above. The matcher treats them as a free agent.']
            ] } },
            { note: 'Leaving the platform default ticked means you follow the catalogue, so if the default list changes yours changes with it. Untick it to set your own and it stays as you leave it.' },
            { proof: 'The Signup page shows your game types, and its next session matches the night you meet.' }
        ]
    },
    {
        id: 'week',
        title: 'Run a week',
        lede: 'The job you will do most. Signups come in, you make the pairings, you publish them.',
        blocks: [
            { where: 'Pairings' },
            { fig: 'fig-signups', caption: 'Signups as they arrive. You can edit anybody’s faction, points, arrival time or vibe if they told you something they did not put on the form.' },
            { p: 'Generate once signups have settled. The evening before works well. You get a draft grid only you can see, which you can edit by hand before anyone else sees it.' },
            { fig: 'fig-grid', caption: 'Read the summary line before publishing. Rematches, mirrors and vibe mismatches are the three things worth a second look.' },
            { p: 'Publish when you are happy. That is the moment the pairings page goes live for players. Then use Post to Discord to push the image into your channel.' },
            { warn: '<b>Regenerating after publishing does not republish.</b> Players keep seeing the old set until you press Publish again.' },
            { p: 'A player who drops out does it themselves, and their opponent is given a bye automatically. Two players can swap opponents between themselves. Neither needs you to regenerate.' },
            { proof: 'A logged-out visitor can see the week on the Pairings page.' }
        ]
    },
    {
        id: 'auto',
        title: 'Stop doing it by hand',
        lede: 'Once you trust the matcher, hand the weekly job over.',
        blocks: [
            { where: 'Call to Arms Post' },
            { fig: 'fig-cta', caption: 'Tokens in braces are filled in when the message posts, so it stays correct without editing.' },
            { p: 'Set how many days before the session the call to arms goes out and at what time, then write the message. <strong>Manual post</strong> sends it immediately for testing a wording change. It does not touch the schedule, so the automatic post still goes out as normal.' },
            { where: 'Auto-pairings' },
            { fig: 'fig-auto', caption: 'Generation and publishing on a schedule of your choosing.' },
            { p: 'Turn this on and the week generates and publishes itself. Most people run it off for a month first, watch what the matcher produces, then switch it on.' },
            { warn: '<b>Auto-pairings publish without asking.</b> That is the point, but it makes the deadline real. Pick a time late enough that stragglers have signed up and early enough that people can plan their evening.' }
        ]
    },
    {
        id: 'tuning',
        title: 'Tune the matchmaking',
        lede: 'Leave this alone until you have run a few weeks. You cannot judge a change without knowing what it was doing before.',
        blocks: [
            { where: 'Weighting' },
            { fig: 'fig-weights', caption: 'Higher means it matters more. Zero means ignore it. The percentages show how much of the total each factor is claiming.' },
            { table: { head: ['Factor', 'Turn it up when'], rows: [
                ['<strong>Avoid same-faction rematch</strong>', 'People grumble about mirror matches.'],
                ['<strong>Avoid recent repeat opponent</strong>', 'A small club keeps producing the same four games.'],
                ['<strong>Match by vibe</strong>', 'Competitive players keep landing on casual ones.'],
                ['<strong>Match by experience</strong>', 'Newcomers are getting flattened.'],
                ['<strong>Match by arrival time</strong>', 'Games start late because one player arrives at eight.'],
                ['<strong>Match by scenario</strong>', 'Players pick their own scenario and disagree.'],
                ['<strong>Match by points</strong>', 'List sizes vary and the mismatches show.']
            ] } },
            { p: 'Two rules are always enforced first, whatever the sliders say: admin blocks, and not repeating last week’s opponent. You cannot weight your way past either.' },
            { note: 'Change one thing at a time and give it a fortnight. Two sliders moved at once tell you nothing about which one did what.' }
        ]
    },
    {
        id: 'league',
        title: 'Run a league',
        lede: 'Optional. A ladder for your system, with players reporting their own results.',
        blocks: [
            { where: 'League' },
            { fig: 'fig-league', caption: 'Seasons, scoring and the standings, all per system.' },
            { p: 'Turn the league on and players can report results from their own profile. Ratings update as results come in, and the standings post to Discord on the club-wide league webhooks.' },
            { p: 'A season gives the ladder a start and an end. Closing one archives its table and crowns a champion, so the next season starts clean without losing the record of the last.' },
            { note: 'Levels and experience tick along from played games whether or not you run a league. They come from published pairings, so you get them for free.' }
        ]
    },
    {
        id: 'missions',
        title: 'Add a mission pool',
        lede: 'Optional, and the cheapest way to make your call to arms worth reading.',
        blocks: [
            { where: 'Missions' },
            { p: 'Add the scenarios you play, each with its objectives and an optional map image. Turn the pool on and the call to arms picks one at random each week and attaches its map.' },
            { p: 'That is the difference between a post saying signups are open and a post people actually stop to read.' }
        ]
    }
];
