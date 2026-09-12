//! Test-only counters for the actual document and directory I/O entry points.
use std::cell::Cell;
thread_local! {
    static READS: Cell<u64> = const { Cell::new(0) };
    static ENTRIES: Cell<u64> = const { Cell::new(0) };
}
pub fn read() {
    READS.with(|n| n.set(n.get() + 1));
}
pub fn entry() {
    ENTRIES.with(|n| n.set(n.get() + 1));
}
pub fn reset() {
    READS.with(|n| n.set(0));
    ENTRIES.with(|n| n.set(0));
}
pub fn snapshot() -> (u64, u64) {
    (READS.with(Cell::get), ENTRIES.with(Cell::get))
}
