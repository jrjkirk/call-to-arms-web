/* Types shared by the club admin page (src/routes/admin) and the components
   its tabs are split into. A type only one tab uses lives in that tab's
   component instead. */

export type BlockEntry = {
    block_id: number;
    player_a_id: number;
    player_a_name: string;
    player_b_id: number;
    player_b_name: string;
    note: string | null;
    /** null when the block is club-wide. */
    system: string | null;
    club_wide: boolean;
};

export type BlockPlayer = { id: number; name: string };
