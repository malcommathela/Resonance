import { useAuth, useUser } from '@clerk/clerk-react'
import { useCallback } from 'react'

// Drop-in replacement for your old Zustand auth store.
// Use this in components that previously used useAuthStore().
//
// All the same properties/methods are available:
//   user, isAuthenticated, isLoading, error
//   init(), login(), handleCallback(), logout(), updateUser()
//
// But now they delegate to Clerk instead of localStorage + cookies.

export function useAuthStore() {
  const { isSignedIn, isLoaded, signOut } = useAuth()
  const { user: clerkUser } = useUser()

  // Map Clerk user to your old user shape
  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress,
    name: clerkUser.fullName || clerkUser.username || clerkUser.firstName || 'User',
    avatar: clerkUser.imageUrl,
  } : null

  return {
    user,
    isAuthenticated: isSignedIn,
    isLoading: !isLoaded,
    error: null, // Clerk handles errors internally

    // init() is a no-op now — Clerk auto-initializes on mount
    init: () => {},

    // login() now redirects to Clerk's sign-in page
    login: (provider) => {
      if (provider === 'github') {
        // Clerk's SignIn component already has GitHub as a social provider
        // Just redirect to the login page
        window.location.href = '/login'
      } else {
        window.location.href = '/login'
      }
    },

    // handleCallback() is a no-op — Clerk handles the OAuth callback internally
    handleCallback: () => {
      return Promise.resolve(user)
    },

    // logout() now uses Clerk's signOut
    logout: async () => {
      await signOut()
    },

    // updateUser() is a no-op for now — user data comes from Clerk
    // If you need to update profile, use Clerk's useUser().update()
    updateUser: (updates) => {
      console.warn("updateUser() is deprecated. Use Clerk's useUser().update() instead.")
    },
  }
}

// Re-export Clerk hooks for direct use when needed
export { useAuth, useUser } from '@clerk/clerk-react'