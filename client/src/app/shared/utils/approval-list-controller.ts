import { Signal, WritableSignal, computed, signal } from '@angular/core';

export type SortDir = 'asc' | 'desc';

export interface ApprovableEntity {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface SortOption {
  key: string;
  label: string;
}

// Shared search + sort + pagination + bulk-selection behaviour for the four
// near-identical owner approval lists (leave/reimbursement/regularization/
// advance). Kept as a plain composable class — constructed once per
// component and driven off that component's own items signal — rather than
// a base component, since search/sort/pagination is genuinely the same
// algorithm four times while each list's markup and fields still differ.
export class ApprovalListController<T extends ApprovableEntity> {
  readonly pageSize = 10;

  readonly search = signal('');
  readonly sortKey: WritableSignal<string>;
  readonly sortDir = signal<SortDir>('asc');
  readonly page = signal(1);
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const items = this.items();
    if (!term) return items;
    return items.filter(item => this.searchText(item).toLowerCase().includes(term));
  });

  readonly sorted = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((a, b) => {
      const av = this.sortValue(a, key);
      const bv = this.sortValue(b, key);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.pageSize)));

  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  readonly paged = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.sorted().slice(start, start + this.pageSize);
  });

  readonly pendingIdsInView = computed(() => this.sorted().filter(i => i.status === 'pending').map(i => i.id));

  readonly selectedCount = computed(() => this.selectedIds().size);

  readonly allPendingSelected = computed(() => {
    const pending = this.pendingIdsInView();
    if (pending.length === 0) return false;
    const selected = this.selectedIds();
    return pending.every(id => selected.has(id));
  });

  constructor(
    private readonly items: Signal<T[]>,
    private readonly searchText: (item: T) => string,
    private readonly sortValue: (item: T, key: string) => number | string,
    defaultSortKey: string,
  ) {
    this.sortKey = signal(defaultSortKey);
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  setSort(key: string): void {
    if (this.sortKey() === key) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  goToPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string): void {
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAllPending(): void {
    this.selectedIds.set(this.allPendingSelected() ? new Set() : new Set(this.pendingIdsInView()));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }
}
