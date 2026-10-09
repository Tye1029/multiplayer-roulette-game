# Blackjack Duel assets

This folder owns the Blackjack Duel client, responsive presentation, and modular bitmap assets. Card faces remain semantic live HTML so ranks and suits stay crisp and accessible; the felt, card back, and chip stack are independent reusable PNG files.

The production game state is server-owned. The client receives only its own cards while a hand is active and uses the shared duel bridge for polling, actions, Remote Bot diagnostics, rematches, and new-game navigation.
