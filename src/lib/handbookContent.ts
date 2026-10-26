/**
 * What the two in-app handbooks say.
 *
 * Content lives here rather than inside the admin page so the guides can be
 * edited without going near 7,000 lines of admin markup, and so the club and
 * system versions can't drift into different voices.
 *
 * Rewritten 2026-10-26 for the app as it now is: the Overview, Pairings as
 * signup rows and game cards, Game System Config as rows, a club's location
 * found by address, pick-up games in place of call-outs, notifications, and
 * coloured titles. Screenshots are real, taken from a club set up for the
 * purpose, and live in static/help/.
 */
import type { Section } from './Handbook.svelte';

/** For a brand-new club super-admin who has just been handed a club. */
export const CLUB_HANDBOOK: Section[] = [
    {
        id: 'overview',
        title: 'Start at the Overview',
        lede: 'Your home in admin. It shows this week at a glance and what is left to set up.',
        blocks: [
            { where: 'Admin › Overview' },
            { fig: 'fig-overview', caption: 'This week on the left, set-up on the right, trends below.' },
            { list: [
                '<strong>This week</strong>: one row per game night, with how many are signed up and whether pairings are live. OPEN takes you to that night’s pairings.',
                '<strong>Set-up</strong>: the steps still to do, each with a button to the right tab. It disappears once you are done.',
                '<strong>Trends</strong>: signups, games, league ratings and factions for one system. The logos above switch between systems.'
            ] }
        ]
    },
    {
        id: 'systems',
        title: 'Turn on the games you play',
        lede: 'Nothing else works until this is done. A system that is off has no signup form and no pairings.',
        blocks: [
            { where: 'Club admin › Systems' },
            { fig: 'fig-systems', caption: 'Each system you turn on becomes its own night, with its own signups, pairings and admins.' },
            { warn: '<b>Turn on only what you run.</b> Every system that is on shows on your club page as a night people can come to. One nobody organises looks like a dead night to a visitor.' },
            { proof: 'The system logos at the top of the admin sidebar list your games, and Sign up offers them.' }
        ]
    },
    {
        id: 'schedule',
        title: 'Set each club night',
        lede: 'Do this for each system before anyone signs up. The schedule decides which week a signup lands in.',
        blocks: [
            { where: 'pick a system › Game System Config' },
            { fig: 'fig-schedule', caption: 'One setting per row. The four default groups open out when you switch them to your own.' },
            { p: '<strong>Day</strong> and <strong>how often</strong> come first. Fortnightly asks for an <strong>anchor date</strong>: any date a session really ran. Fortnights count from there, and you never need to change it again.' },
            { p: '<strong>Start time</strong> is optional. It sets the arrival times players pick from and shows on your club calendar.' },
            { p: 'Lower down is the <strong>club page card</strong>: a photo, a blurb of up to 250 characters, and the night’s colour. That colour is used for the night everywhere in the app.' },
            { warn: '<b>Moving the day moves more than the day.</b> It changes which week signups land in, what your calendar shows, and when the call to arms posts.' },
            { proof: 'Your club page lists the night on the right day, with its photo and blurb.' }
        ]
    },
    {
        id: 'page',
        title: 'Put your club on the map',
        lede: 'This is what a stranger sees when they find you, and where your pin goes on the Clubs page.',
        blocks: [
            { where: 'Club admin › Club page' },
            { fig: 'fig-clubpage', caption: 'Type the address and press FIND. Then drag the pin to your door.' },
            { p: 'Type your address with its postcode and press <strong>FIND</strong>. The pin drops on the postcode and the region fills itself in. Drag the pin, or tap the map, to put it exactly on your door, then save.' },
            { p: 'Add your <strong>logo</strong> here too. It shows on your club page and on every pairings image posted to Discord. Opening hours are on the same tab.' },
            { note: 'Your blurb, website and Discord invite live in Venue Admin › Settings › Venue.' },
            { proof: 'Open the Clubs page from the Me menu. Your club has a pin, and tapping it shows your card.' }
        ]
    },
    {
        id: 'discord',
        title: 'Connect Discord',
        lede: 'Most of what the app does ends in a Discord post. Without this the app still works, but it is very quiet.',
        blocks: [
            { where: 'pick a system › Discord' },
            { fig: 'fig-discord', caption: 'One webhook per kind of post, set per system, so each night can post to its own channel.' },
            { p: 'A <strong>webhook</strong> is a link that lets the app post into one Discord channel. Make it in Discord: hover the channel, click its cog, go to <strong>Integrations</strong>, then <strong>Create Webhook</strong>. Pick the channel, press <strong>Copy Webhook URL</strong>, and paste it here.' },
            { p: 'You need the <strong>Manage Webhooks</strong> permission on that server. Without it, Integrations will not open. Ask whoever runs the server to grant it, or to make the webhook and send you the link in a direct message.' },
            { table: { head: ['Webhook', 'Posts'], rows: [
                ['<strong>Signup notifications</strong>', 'Each signup and drop-out'],
                ['<strong>Pairings post</strong>', 'The week’s games, as an image'],
                ['<strong>Call to Arms post</strong>', 'The weekly “signups are open” message'],
                ['<strong>Pick-up games</strong>', 'A player asking for a game, a game confirmed, a game called off'],
                ['<strong>Level-up</strong>', 'A player reaching level 10, 20, 30 and so on'],
                ['<strong>League result, rankings, achievements</strong>', 'Once that system’s league is on']
            ] } },
            { p: 'Switches beside Signups and Games on the Pairings tab turn signup and pairings posts off without removing the webhook. They are handy while you are testing.' },
            { warn: '<b>A webhook link is a password.</b> Anyone holding it can post into that channel as your club, with no login. If one leaks, delete it in Discord and make a new one.' },
            { proof: 'Sign yourself up and watch the post land in the right channel.' }
        ]
    },
    {
        id: 'admins',
        title: 'Hand out admin jobs',
        lede: 'Optional, and worth doing early. Running every night yourself is how a club stalls the week you are away.',
        blocks: [
            { where: 'Club admin › Admins' },
            { fig: 'fig-admins', caption: 'Admin is given per system, so someone can run one night without the keys to the club.' },
            { p: 'Whoever runs your Kill Team night can be given Kill Team and nothing else. They make its pairings, set its schedule and write its call to arms. They cannot touch your other nights or your club settings.' },
            { note: 'They must have signed in at least once before you can appoint them. An account only exists after its first sign-in.' },
            { proof: 'They see an Admin tab with their system’s logo, and only theirs.' }
        ]
    },
    {
        id: 'week',
        title: 'Run your first week',
        lede: 'Everything above you do once. This is the loop you run every week.',
        blocks: [
            { where: 'pick a system › Pairings' },
            { fig: 'fig-grid', caption: 'Signups on the left, games on the right. Tap a signup, or ⋯ on a game, to edit it in place.' },
            { p: 'Once signups settle, press <strong>GENERATE</strong>. You get a draft only admins can see. Read the line above the games: it counts rematches, mirror matches and mismatched kinds of game. Fix anything by tapping ⋯ on a game, then <strong>SAVE PAIRING CHANGES</strong>.' },
            { p: '<strong>PUBLISH</strong> is the moment players see the week, and the moment they are notified. <strong>POST TO DISCORD</strong> sends the pairings image.' },
            { warn: '<b>Generating again after publishing does not republish.</b> Players keep the old set until you press Publish again.' },
            { p: 'After publishing, the week looks after itself. A player who drops out has their opponent re-seated, with someone sitting out if possible. A late signup is seated the same way. Two players can swap opponents themselves. None of this needs you to generate again.' },
            { proof: 'The panel header reads PUBLISHED, and the week shows on the Pairings tab for players.' }
        ]
    },
    {
        id: 'players',
        title: 'Players, titles and blocks',
        lede: 'Who plays, what they have won, and who should never be paired together.',
        blocks: [
            { where: 'pick a system › Players' },
            { p: 'The roster for that system, with games, level and rating. <strong>Edit</strong> on a player opens their titles. Give each title a name and pick its colour. Titles show on the player’s profile, club-wide.' },
            { where: 'Club admin › Players & blocks' },
            { p: 'A <strong>block</strong> stops the matcher ever pairing two players. Blocks are always obeyed, whatever the weighting says. Archive a player who has left: their history stays, and they leave the lists.' }
        ]
    },
    {
        id: 'roles',
        title: 'Who can do what',
        lede: 'Four levels, kept narrow on purpose.',
        blocks: [
            { table: { head: ['Role', 'Can', 'Cannot'], rows: [
                ['<strong>Club super-admin</strong><br>you', 'Everything for this club: systems, club page, Discord, admins, venue and table booking', 'Touch another club'],
                ['<strong>System admin</strong>', 'Everything for their system: pairings, schedule, kinds of game, call to arms, its Discord and its league', 'Club settings, other systems, appointing admins'],
                ['<strong>Venue staff</strong>', 'The venue diary, bookings, floor plan and club-night tables', 'Anything about games or players'],
                ['<strong>Player</strong>', 'Sign up, drop out, re-arrange, ask for pick-up games, report results, book a table', 'See any admin screen']
            ] } }
        ]
    },
    {
        id: 'more',
        title: 'The rest of it',
        lede: 'None of this is needed to run a club night. Add it when the club asks.',
        blocks: [
            { p: '<strong>Leagues</strong> give a system a ladder. Players report their own results and the standings post to Discord. It is per system, so one night can be competitive and another purely social.' },
            { p: '<strong>Pick-up games</strong> are for games outside club night. A player says when they are free and the app pairs them with someone who is free then too. Both accept, and it is on. There is nothing for you to run.' },
            { p: '<strong>Events</strong> are one-off days such as a tournament. Admins add them from the Events page with <strong>+ NEW EVENT</strong>.' },
            { p: '<strong>Notifications</strong>: players who turn them on get a buzz when pairings go up, their opponent drops, their game changes, or a pick-up game is found. Publishing is what sends the first one, so publish when you mean it.' },
            { p: '<strong>Venue Admin</strong> is for clubs that run their own venue: a floor plan, public table bookings, and every published game seated on a named table. If you play at someone else’s venue, <strong>Table booking</strong> emails them your table count each week instead.' }
        ]
    }
];

/** For somebody handed one game system to run. */
export const SYSTEM_HANDBOOK: Section[] = [
    {
        id: 'yours',
        title: 'What you have been given',
        lede: 'You run one game system. Everything in the sidebar under THIS SYSTEM is yours.',
        blocks: [
            { p: 'You decide when your night meets, the kinds of game it offers, where it posts on Discord, how its pairings are made, what its call to arms says, and whether it runs a league.' },
            { p: 'Club settings are not in your sidebar at all, so there is nothing here you can break for anyone else. If more than one system is yours, the logos at the top of the sidebar switch between them.' },
            { note: 'If a setting you need is missing, it is a club one. Ask your club super-admin.' }
        ]
    },
    {
        id: 'schedule',
        title: 'Set your night and its kinds of game',
        lede: 'Start here. The schedule decides which week a signup lands in.',
        blocks: [
            { where: 'Game System Config' },
            { fig: 'fig-schedule', caption: 'One setting per row. Switch a default group off to set your own.' },
            { p: 'Pick your <strong>day</strong> and <strong>how often</strong>. Fortnightly needs an <strong>anchor date</strong>: any date a session really ran. The <strong>start time</strong> sets the arrival times players choose from.' },
            { p: '<strong>Vibes</strong> are the kinds of game players choose between. Each has a way it pairs:' },
            { table: { head: ['How it pairs', 'Means'], rows: [
                ['<strong>Preference</strong>', 'Matched like with like where possible. Casual and Competitive work this way.'],
                ['<strong>Matches anything</strong>', 'Happy with any game. Open works this way.'],
                ['<strong>Own bracket</strong>', 'Only ever paired with itself, for a different game such as a smaller points Battle March.']
            ] } },
            { p: '<strong>Intro games</strong> need two things on your signup form: the Intro vibe, for players who want teaching, and the <strong>can lead an intro game</strong> option, for players who will teach. The matcher puts a teacher with a learner whenever one is free.' },
            { p: '<strong>Standby</strong> lets a player offer to sit out when the numbers are odd. If anyone offers, they take the bye instead of someone who came to play.' },
            { note: 'Leaving a group on Platform defaults means you follow the app’s list, and it changes if that list does. Switch it off to set your own, and it stays as you leave it.' },
            { proof: 'Sign up shows your kinds of game, and the night’s tile shows the right day.' }
        ]
    },
    {
        id: 'discord',
        title: 'Point your night at Discord',
        lede: 'Your system posts its own signups, pairings and call to arms. Until you set these, it posts nowhere.',
        blocks: [
            { where: 'Discord' },
            { fig: 'fig-discord', caption: 'One webhook per kind of post. They are yours to set.' },
            { p: 'A <strong>webhook</strong> is a link that lets the app post into one Discord channel. Make it in Discord: hover the channel, click its cog, go to <strong>Integrations</strong>, then <strong>Create Webhook</strong>. Copy its URL and paste it here.' },
            { p: 'You need <strong>Manage Webhooks</strong> on that server. Without it, Integrations will not open. Ask whoever runs the server to grant it, or to send you the link in a direct message.' },
            { table: { head: ['Webhook', 'Posts', 'When'], rows: [
                ['<strong>Signup notifications</strong>', 'Each signup and drop-out', 'All week'],
                ['<strong>Pairings post</strong>', 'The week’s games, as an image', 'When you press Post to Discord, or auto-pairings run'],
                ['<strong>Call to Arms post</strong>', '“Signups are open”', 'On the schedule you set'],
                ['<strong>Pick-up games</strong>', 'A request, a confirmed game, a game called off', 'As it happens'],
                ['<strong>Level-up</strong>', 'A player reaching level 10, 20, 30 and so on', 'As it happens'],
                ['<strong>League</strong>', 'Results, rankings and achievements', 'Once your league is on']
            ] } },
            { warn: '<b>A webhook link is a password.</b> Never paste one in a public channel or a screenshot. If one leaks, delete it in Discord and make a new one.' },
            { proof: 'Sign yourself up and watch the post appear in your channel.' }
        ]
    },
    {
        id: 'week',
        title: 'Run a week',
        lede: 'The job you do most: signups come in, you make the pairings, you publish them.',
        blocks: [
            { where: 'Pairings' },
            { fig: 'fig-grid', caption: 'Signups on the left, games on the right. Tap to edit either in place.' },
            { p: 'Each <strong>signup</strong> is a row with its vibe colour, the player, their faction, arrival time and points. Tap it to change anything they told you but didn’t put on the form, or to drop them. <strong>+ ADD</strong> signs someone up for them.' },
            { p: 'Press <strong>GENERATE</strong> once signups settle; the evening before works well. Read the line above the games for rematches, mirror matches and mismatched kinds of game. Tap ⋯ on a game to change who plays, factions, kinds of game, time or points, then <strong>SAVE PAIRING CHANGES</strong>.' },
            { p: '<strong>PUBLISH</strong> shows the week to players and notifies them. <strong>POST TO DISCORD</strong> sends the image.' },
            { warn: '<b>Generating again after publishing does not republish.</b> Players keep the old set until you press Publish again.' },
            { p: 'Once published, drop-outs and late signups re-seat themselves, and two players can swap opponents. <strong>Re-arrange a game</strong>, below the games, pairs two players by hand.' },
            { p: '<strong>Signup cap</strong>, at the foot of the tab, limits a night to a number of tables. Once it is full, new signups are turned away.' },
            { proof: 'The header reads PUBLISHED, and your players can see the week.' }
        ]
    },
    {
        id: 'missions',
        title: 'Build a mission pool',
        lede: 'Optional, and the easiest way to get your call to arms read. A post with this week’s map gets opened.',
        blocks: [
            { where: 'Call to Arms' },
            { fig: 'fig-missions', caption: 'The pool and its upload form. Both switches start off.' },
            { p: 'Switch on <strong>custom missions</strong>, and <strong>secondary objectives</strong> too if your game has them. Then add missions one at a time: a name, an image, and the secondary objectives if you use them.' },
            { table: { head: ['Field', 'What to put in it'], rows: [
                ['<strong>Name</strong>', 'As your players say it: <em>King of the Hill</em>, not <em>mission 2b</em>.'],
                ['<strong>Secondary objectives</strong>', 'A comma-separated list, exactly as it should read in the post.'],
                ['<strong>Image</strong>', 'The map or deployment, landscape, about 1200px wide. PNG, JPG or WEBP, up to 5 MB.']
            ] } },
            { warn: '<b>Use a clean crop of the map,</b> not a phone photo of a screen. Every player sees it that week.' },
            { p: 'Each call to arms picks one active mission at random. Untick <strong>Active</strong> to keep a mission without it being posted.' }
        ]
    },
    {
        id: 'tokens',
        title: 'Write the call to arms',
        lede: 'Write it once with tokens, and every week’s post fills itself in.',
        blocks: [
            { where: 'Call to Arms' },
            { fig: 'fig-cta', caption: 'The tokens your system can fill are listed under the message box.' },
            { p: 'Set how many days before the night it posts, and at what time. A <strong>token</strong> is a word in braces that is swapped for the real value as the post goes out.' },
            { table: { head: ['Token', 'Becomes'], rows: [
                ['<code>{session_date}</code>', 'The date of the next night'],
                ['<code>{signup_url}</code>', 'A link straight to Sign up'],
                ['<code>{scenario_name}</code>', 'The picked mission’s name'],
                ['<code>{secondary_objectives}</code>', 'That mission’s secondary objectives']
            ] } },
            { p: 'The mission image is attached on its own. It needs no token.' },
            { warn: '<b>A token only fills if there is something behind it.</b> <code>{secondary_objectives}</code> with that switch off comes out as an empty line. Take out tokens you don’t use.' },
            { p: '<strong>Manual post</strong> sends the real message now, for checking your wording. It doesn’t change the schedule.' },
            { proof: 'A manual post lands with a real date, a mission name and its map, and no stray braces.' }
        ]
    },
    {
        id: 'auto',
        title: 'Let the week run itself',
        lede: 'Once you trust the matcher, hand the weekly job over.',
        blocks: [
            { where: 'Auto-pairings' },
            { fig: 'fig-auto', caption: 'Generate and publish on a day and time you choose.' },
            { p: 'Switch it on and the week generates and publishes itself at that time. Sign up then tells players when it happens, for example “Pairings go up Tuesday at 20:00”. With it off, that line isn’t shown.' },
            { warn: '<b>Auto-pairings publish without asking.</b> Pick a time late enough for stragglers and early enough for people to plan their evening. Many run it off for a month first and watch what the matcher does.' }
        ]
    },
    {
        id: 'tuning',
        title: 'Tune the matchmaking',
        lede: 'Leave this alone for a few weeks first. You can’t judge a change without knowing what it did before.',
        blocks: [
            { where: 'Weighting' },
            { fig: 'fig-weights', caption: 'Higher matters more; zero ignores it.' },
            { table: { head: ['Factor', 'Turn it up when'], rows: [
                ['<strong>Avoid same-faction rematch</strong>', 'People grumble about mirror matches.'],
                ['<strong>Avoid recent repeat opponent</strong>', 'A small club keeps producing the same games.'],
                ['<strong>Vibe match</strong>', 'Competitive players keep landing on casual ones.'],
                ['<strong>Experience match</strong>', 'Newcomers keep getting flattened.'],
                ['<strong>Arrival time (ETA) match</strong>', 'Games start late because one player arrives late.'],
                ['<strong>Scenario match</strong>', 'Players pick scenarios and disagree. Only shown if your system asks for one.'],
                ['<strong>Points closeness</strong>', 'List sizes vary and it shows. Only shown if your system uses points.'],
                ['<strong>Avoid same faction category</strong>', 'Too many games are, say, two undead armies. Only for systems with faction groups.']
            ] } },
            { p: 'Some rules always come first, whatever the sliders say: blocks, not repeating last week’s opponent, and never pairing across an own-bracket vibe.' },
            { note: 'Change one thing at a time and give it a fortnight.' }
        ]
    },
    {
        id: 'players',
        title: 'Your players and their titles',
        lede: 'The roster for your night.',
        blocks: [
            { where: 'Players' },
            { p: 'Everyone who has played your system, with games, level and rating. <strong>Edit</strong> on a player opens their titles: give each one a name and a colour. Titles show on their profile across the whole club, so agree them with any other system admins.' },
            { p: 'Blocks set here stop two players being paired in your system only.' }
        ]
    },
    {
        id: 'league',
        title: 'Run a league',
        lede: 'Optional. A ladder for your night, with players reporting their own results.',
        blocks: [
            { where: 'League' },
            { fig: 'fig-league', caption: 'Seasons, scoring and standings, for your system alone.' },
            { p: 'Turn the league on and players report results from the Leagues tab. Ratings update as results come in, and the standings post to Discord on your league webhooks.' },
            { p: 'A season gives the ladder a start and an end. Starting a new one resets ratings and archives the old table with its champion.' },
            { note: 'Levels and experience grow from played games whether or not you run a league.' }
        ]
    }
];
