# Search screen checklist — Phase 0

Finalized 2026-11-11, Asia/Manila. This is the executable Section 4 adaptation,
not a claim of parity with a particular current Messenger build. Later phases
implement these states; Phase 4 owns their integrated device observation.

## Public reference findings

- [MessagingAppLab, 2023-08-26](https://messagingapplab.com/delete-recent-searches-facebook-messenger/)
  describes Android/iOS search entry, recent contacts, Edit, individual removal,
  and Clear All. Android images are linked by the article, but fetching those
  image assets failed. No build number or measured geometry is supplied.
- [Aranzulla, search-history section](https://www.aranzulla.it/come-cancellare-cronologia-messenger-1146809.html)
  supports recent-search removal/clear management. Publication/build identity is
  unavailable; its broader message-history instructions are not a search spec.
- [Adweek, in-chat search](https://www.adweek.com/media/messenger-how-to-search-for-messages-in-chats-on-mobile/)
  search-index excerpt supports conversation-details entry and a typed query.
  Full retrieval redirects to inaccessible Tollbit. Treat the excerpt as limited
  supporting evidence, not an inspected screenshot or current-build reference.
- The retained [iPhoneLife link](https://www.iphonelife.com/blog/32671/tip-day-how-search-message-conversations)
  is **Apple Messages**, dated 2024-09-16. Excluded from Messenger evidence.

No Messenger app, unrelated account or unrelated emulator was opened. Exact
current-build geometry remains unverified (B01); the plan explicitly accepts
Section 4 as the DoloGram adaptation.

## Final state/acceptance checklist

| State | Implementation target | Later verification |
| --- | --- | --- |
| Entry | Existing header icon/expansion; 56 logical-pixel toolbar plus inset; 40-pixel rounded field; Search placeholder; Back; clear action has a non-overlapping 44-pixel target. Direct entry works. | V02/V09/V11 |
| Blank | Recent searches: horizontal 64-pixel avatars, two name lines, Edit. Suggested: up to ten eligible chats by activity, 48-pixel avatars. Empty state includes username lookup. | V02/V06/V11 |
| Query | All/People/Groups/Messages strip; selection survives typing; clear returns All; 16-pixel outer spacing, 12-pixel gaps, token typography, rows at least 72 pixels and able to grow. | V02/V10/V11 |
| Categories | People open people; Groups open groups; Messages group completed delivered counts by conversation. All shows three per section, See all selects the category at its top. Truthful category-specific empty feedback. | V02/V03/V05/V11 |
| Scoped | Single field/Back/scope label; virtualized sender/year-inclusive date/contextual two-line snippets; query prefill; cursor pagination and accessible Show more. Pending items identified separately. | V04/V05/V11 |
| Context | Original message and surrounding history; term and focused-row treatment only on selected message; unavailable-target return action; Jump to latest ends treatment; Back retains both search routes. | V05/V08/V09/V11 |
| Edit history | Removable rows, Done, confirmed Clear all, Cancel preserves history; failure preserves durable entries and Retry. Android Back dismisses confirmation, then edit mode, then route, respecting native keyboard behavior. | V06/V09/V11 |
| Loading/error | Names remain usable during counting; exact total only when complete; explicit read/timeout/offline/history failures and bounded user retry. No failed scan presented as zero matches. | V02/V04/V06/V07/V11 |

All states use current account-selected theme, accent and typography tokens.
Check both themes, custom outgoing bubble backgrounds, compact width, enlarged
text, safe areas, keyboard, native Back, reduced motion, focus on fresh entry
only, selected-filter labels, 44-pixel actions and 4.5:1 text contrast.

Four filters, three-row section cap, counts, ranking, dimensions, year-inclusive
dates, history capacity/account locality, highlight behavior and accessibility
targets are explicit **DoloGram design decisions**. Public references do not
establish these exact values for Messenger.
