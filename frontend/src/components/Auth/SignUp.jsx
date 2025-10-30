import { SignUp as ClerkSignUp } from '@clerk/clerk-react';

export default function SignUp() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'var(--bg-secondary)'
    }}>
      <ClerkSignUp 
        routing="path" 
        path="/sign-up"
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

