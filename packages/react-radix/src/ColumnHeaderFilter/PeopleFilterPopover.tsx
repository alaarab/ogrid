import * as React from 'react';
import type { UserLike } from '@alaarab/ogrid-react';
import styles from './ColumnHeaderFilter.module.scss';

export interface PeopleFilterPopoverProps {
  selectedUser: UserLike | undefined;
  searchText: string;
  onSearchChange: (value: string) => void;
  suggestions: UserLike[];
  isLoading: boolean;
  onUserSelect: (user: UserLike) => void;
  onClearUser: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function UserAvatar({ user, size = 32 }: { user: UserLike; size?: number }) {
  if (user.photo) {
    return <img src={user.photo} alt="" width={size} height={size} style={{ borderRadius: '50%' }} />;
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
      }}
    >
      {user.displayName?.charAt(0) ?? '?'}
    </span>
  );
}

export const PeopleFilterPopover: React.FC<PeopleFilterPopoverProps> = ({
  selectedUser,
  searchText,
  onSearchChange,
  suggestions,
  isLoading,
  onUserSelect,
  onClearUser,
  inputRef,
}) => (
  <>
    {selectedUser && (
      <div className={styles.selectedUserSection}>
        <div className={styles.selectedUserLabel}>Currently filtered by:</div>
        <div className={styles.selectedUser}>
          <div className={styles.userInfo}>
            <UserAvatar user={selectedUser} />
            <div className={styles.userText}>
              <div>{selectedUser.displayName}</div>
              <div className={styles.userSecondary}>{selectedUser.email}</div>
            </div>
          </div>
          <button
            type="button"
            className={styles.removeUserButton}
            onClick={onClearUser}
            aria-label="Remove filter"
          >
            ✕
          </button>
        </div>
      </div>
    )}
    <div className={styles.popoverSearch}>
      <div className={styles.nativeInputWrapper}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          className={styles.nativeInput}
          placeholder="Search for a person..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
      </div>
    </div>
    <div className={styles.popoverOptions}>
      {isLoading && searchText.trim() ? (
        <div className={styles.loadingContainer}>Searching...</div>
      ) : suggestions.length === 0 && searchText.trim() ? (
        <div className={styles.noResults}>No results found</div>
      ) : searchText.trim() ? (
        suggestions.map((user) => (
          <div
            key={user.id ?? user.email ?? user.displayName ?? ''}
            className={styles.personOption}
            onClick={() => onUserSelect(user)}
            onKeyDown={(e) => e.key === 'Enter' && onUserSelect(user)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.userInfo}>
              <UserAvatar user={user} />
              <div className={styles.userText}>
                <div>{user.displayName}</div>
                <div className={styles.userSecondary}>{user.email}</div>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className={styles.noResults}>Type to search...</div>
      )}
    </div>
    {selectedUser && (
      <div className={styles.popoverActions}>
        <button type="button" className={styles.clearButton} onClick={onClearUser}>
          Clear Filter
        </button>
      </div>
    )}
  </>
);

PeopleFilterPopover.displayName = 'PeopleFilterPopover';
