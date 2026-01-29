import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";

//import type { Session } from "@supabase/supabase-js";

import { LoginForm } from "./components/login-form";
import { SignUpForm } from "./components/sign-up-form";

import App from "./App";
import "@/styles/index.css";
//import { createClient } from '@/lib/supabase/client';
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardFooter } from "./components/ui/card";
import { Button } from "./components/ui/button";


export default function Site() {
    //const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
      console.log('startup effect');
    });
  
    return (
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/protected" element={<AuthTest />} />

        <Route 
          path="/app" 
          element={
            <AuthGate>
              <App user={supabase.auth.getUser().then(d=> d.data.user.email)}/>
            </AuthGate>
          } 
        />

      </Routes>
    )
  

  function Login() {
    return (<>
      <article>
        <LoginForm className='login-form' />
      </article>
    </>);
  }

  function SignUp() {
    return (<>
      <article>
        <SignUpForm className='signup-form' />
      </article>
    </>);
  }

  function Splash() {
    return (
      <article>
        <Card className='w-100 m-auto my-50'>

          <CardContent>
      <p>This is gonna be a really cool app. Check it out.</p>
          </CardContent>
            <CardFooter>
              <Link to="/login"><Button>Log in</Button></Link>
              <span style={{width: '20px'}}></span>
              <Link to="/signup"><Button>Sign up</Button></Link>
              <span style={{width: '20px'}}></span>
              <Link to="/sandbox"><Button>Try it out</Button></Link>
            </CardFooter>
        </Card>
      </article>
    )
  }


  function AuthTest() {
    const [status, setStatus] = useState('loading...')
    const [snapshots, setSnapshots] = useState<[]>([])
    //const supabase = createClient();

    useEffect(() => {
      async function runTest() {
        // 1. confirm session exists
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          setStatus('❌ no session')
          return
        }

        // 2. query tasks
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .limit(5)

        if (error) {
          setStatus('❌ query failed')
          console.error(error)
          return
        }

        setSnapshots(data ?? [])
        setStatus('✅ authenticated query succeeded')
      }

    runTest()
    }, [])
    return (<article>
      <div>
        <h2>Auth Test</h2>
        <p>{status}</p>
        <pre>{JSON.stringify(snapshots, null, 2)}</pre>
      </div>
    </article>)
  }

  function AuthGate({ children }: { children: React.ReactNode } ) {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);

    useEffect(() => {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setLoading(false);
      });

      return () => sub.subscription.unsubscribe();
    }, [])

    if (loading) return null;
    if (!session) return <Navigate to='/login' />

    return <>{children}</>
  }

}

