import { useState, useEffect, useCallback, useRef } from 'react';
import {
  createUserPool,
  getCurrentSession,
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
  getGroupsFromToken,
  getUserAttributesFromToken,
} from './cognito.js';

/**
 * React hook that manages Cognito authentication state.
 *
 * @param {{ userPoolId: string, clientId: string }} config
 * @returns {{
 *   user: { email: string, sub: string } | null,
 *   groups: string[],
 *   isLoading: boolean,
 *   error: Error | null,
 *   signIn: (email: string, password: string) => Promise<void>,
 *   signOut: () => void,
 *   hasGroup: (groupName: string) => boolean,
 *   isAdmin: boolean,
 * }}
 */
export function useAuth({ userPoolId, clientId }) {
  const userPoolRef = useRef(null);

  // Lazily create/reuse the user pool instance.
  if (!userPoolRef.current) {
    userPoolRef.current = createUserPool(userPoolId, clientId);
  }

  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Hydrate state from a valid session object. */
  const hydrateFromSession = useCallback((session) => {
    const attributes = getUserAttributesFromToken(session);
    const sessionGroups = getGroupsFromToken(session);
    setUser(attributes);
    setGroups(sessionGroups);
  }, []);

  // Restore session on mount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await getCurrentSession(userPoolRef.current);
        if (!cancelled) {
          if (session) {
            hydrateFromSession(session);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Signs the user in and updates auth state.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  const signIn = useCallback(
    async (email, password) => {
      setError(null);
      setIsLoading(true);
      try {
        const { session } = await cognitoSignIn(userPoolRef.current, email, password);
        hydrateFromSession(session);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [hydrateFromSession]
  );

  /**
   * Signs the current user out and clears auth state.
   */
  const signOut = useCallback(() => {
    cognitoSignOut(userPoolRef.current);
    setUser(null);
    setGroups([]);
    setError(null);
  }, []);

  /**
   * Returns true if the current user belongs to the given Cognito group.
   * @param {string} groupName
   * @returns {boolean}
   */
  const hasGroup = useCallback(
    (groupName) => groups.includes(groupName),
    [groups]
  );

  const isAdmin = hasGroup('admin');

  return {
    user,
    groups,
    isLoading,
    error,
    signIn,
    signOut,
    hasGroup,
    isAdmin,
  };
}
