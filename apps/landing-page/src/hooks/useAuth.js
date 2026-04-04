import { useState, useEffect, useCallback } from 'react'
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js'

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
}

// Only instantiate the pool when both values are present to avoid SDK errors
// in environments where env vars haven't been set yet.
function getUserPool() {
  if (!poolData.UserPoolId || !poolData.ClientId) {
    return null
  }
  return new CognitoUserPool(poolData)
}

/**
 * Parse Cognito groups out of an id-token payload.
 * The "cognito:groups" claim is an array of group name strings.
 */
function parseGroups(session) {
  try {
    const payload = session.getIdToken().decodePayload()
    return Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] : []
  } catch {
    return []
  }
}

/**
 * Parse user identity fields out of an id-token payload.
 */
function parseUser(session, cognitoUser) {
  try {
    const payload = session.getIdToken().decodePayload()
    return {
      username: cognitoUser.getUsername(),
      email: payload.email ?? cognitoUser.getUsername(),
    }
  } catch {
    return {
      username: cognitoUser.getUsername(),
      email: cognitoUser.getUsername(),
    }
  }
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [groups, setGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // On mount, restore any existing Cognito session from local storage.
  useEffect(() => {
    const pool = getUserPool()
    if (!pool) {
      setIsLoading(false)
      return
    }

    const cognitoUser = pool.getCurrentUser()
    if (!cognitoUser) {
      setIsLoading(false)
      return
    }

    cognitoUser.getSession((err, session) => {
      if (err || !session?.isValid()) {
        setIsLoading(false)
        return
      }
      setUser(parseUser(session, cognitoUser))
      setGroups(parseGroups(session))
      setIsLoading(false)
    })
  }, [])

  /**
   * Sign in with email + password.
   * Returns a promise that resolves on success or rejects with an Error.
   */
  const signIn = useCallback((email, password) => {
    return new Promise((resolve, reject) => {
      const pool = getUserPool()
      if (!pool) {
        reject(new Error('Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID.'))
        return
      }

      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      })

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: pool,
      })

      cognitoUser.authenticateUser(authDetails, {
        onSuccess(session) {
          setUser(parseUser(session, cognitoUser))
          setGroups(parseGroups(session))
          resolve()
        },
        onFailure(err) {
          reject(new Error(err.message ?? 'Authentication failed'))
        },
        // Surface new-password-required challenge as a readable error
        // rather than leaving the promise hanging silently.
        newPasswordRequired() {
          reject(new Error('A new password is required. Please contact an administrator.'))
        },
      })
    })
  }, [])

  /**
   * Sign out the current user and clear local session state.
   */
  const signOut = useCallback(() => {
    const pool = getUserPool()
    if (!pool) return

    const cognitoUser = pool.getCurrentUser()
    if (cognitoUser) {
      cognitoUser.signOut()
    }
    setUser(null)
    setGroups([])
  }, [])

  return { user, groups, isLoading, signIn, signOut }
}
