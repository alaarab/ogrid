import * as React from 'react';
import { SearchRegular, FilterRegular } from '@fluentui/react-icons';
import type { UserLike } from '@alaarab/ogrid-react';
import styles from './ColumnHeaderFilter.module.scss';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '').toUpperCase();
}

export interface PeopleFilterPopoverProps {
  selectedUser: UserLike | undefined;
  searchText: string;
  onSearchChange: (value: string) => void;
  suggestions: UserLike[];
  isLoading: boolean;
  onUserSelect: (user: UserLike) => void;
  onClearUser: () => void;
  onPopoverClick: (e: React.MouseEvent) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

export const PeopleFilterPopover: React.FC<PeopleFilterPopoverProps> = ({
  selectedUser,
  searchText,
  onSearchChange,
  suggestions,
  isLoading,
  onUserSelect,
  onClearUser,
  onPopoverClick,
  inputRef,
}) => (
  <>
    {selectedUser && (
      <div className={styles.selectedUserSection} onClick={onPopoverClick}>
        <div className={styles.selectedUserLabel}>Currently filtered by:</div>
        <div className={styles.selectedUser}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {selectedUser.photo
                ? <img src={selectedUser.photo} alt="" className={styles.avatarImg} />
                : <span className={styles.avatarInitials}>{getInitials(selectedUser.displayName)}</span>
              }
            </div>
            <div className={styles.userText}>
              <div>{selectedUser.displayName}</div>
              <div className={styles.userSecondary}>{selectedUser.email}</div>
            </div>
          </div>
          <button type="button" className={styles.removeUserButton} onClick={onClearUser} aria-label="Remove filter">
            <FilterRegular />
          </button>
        </div>
      </div>
    )}
    <div className={styles.popoverSearch} onClick={onPopoverClick}>
      <div className={styles.nativeInputWrapper}>
        <SearchRegular className={styles.nativeInputIcon} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search for a person..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          autoComplete="off"
          className={styles.nativeInput}
        />
      </div>
    </div>
    <div className={styles.popoverOptions} onClick={onPopoverClick}>
      {isLoading && searchText.trim() ? (
        <div className={styles.loadingContainer}>
          <div className={styles.filterSpinner} />
          <span style={{ fontSize: 12, color: 'var(--colorNeutralForeground2, #616161)' }}>Searching...</span>
        </div>
      ) : suggestions.length === 0 && searchText.trim() ? (
        <div className={styles.noResults}>No results found</div>
      ) : searchText.trim() ? (
        suggestions.map((user) => (
          <div
            key={user.id ?? user.email ?? user.displayName}
            className={styles.personOption}
            onClick={(e) => {
              e.stopPropagation();
              onUserSelect(user);
            }}
          >
            <div className={styles.userInfo}>
              <div className={styles.avatar}>
                {user.photo
                  ? <img src={user.photo} alt="" className={styles.avatarImg} />
                  : <span className={styles.avatarInitials}>{getInitials(user.displayName)}</span>
                }
              </div>
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
      <div className={styles.popoverActions} onClick={onPopoverClick}>
        <button type="button" className={styles.clearButton} onClick={onClearUser}>
          Clear Filter
        </button>
      </div>
    )}
  </>
);

PeopleFilterPopover.displayName = 'PeopleFilterPopover';
