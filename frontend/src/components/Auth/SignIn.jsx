import { SignIn as ClerkSignIn } from '@clerk/clerk-react';

export default function SignIn() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'var(--bg-secondary)'
    }}>
      <ClerkSignIn 
        routing="path" 
        path="/sign-in"
        appearance={{
          elements: {
            rootBox: {
              margin: '0 auto',
            },
            card: {
              boxShadow: 'var(--shadow-lg)',
              borderRadius: '16px',
            }
          }
        }}
      />
    </div>
  );
}

