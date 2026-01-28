import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

//import type { Session } from "@supabase/supabase-js";

import { LoginForm } from "./components/login-form";
import { SignUpForm } from "./components/sign-up-form";

import App from "./App";
import "@/styles/index.css";
//import { createClient } from '@/lib/supabase/client';
import { supabase } from "@/lib/supabase/client";


import { 
  DropdownMenu, 
  DropdownMenuCheckboxItem, 
  DropdownMenuContent, DropdownMenuGroup, 
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuLabel 
} from '@/components/ui/dropdown-menu.tsx';
import { BellIcon, CloudDownload, CloudDownloadIcon, CloudUpload, LogOutIcon, MailIcon, MessageSquareIcon, Tag, UserIcon } from "lucide-react";
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
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/protected" element={<AuthTest />} />

        <Route 
          path="/app" 
          element={
            <AuthGate>
              <App user={supabase.auth.getUser().then(d=> d.data.user.email)}/>
            </AuthGate>
          } 
        />

        <Route path="/test" element={<Test />} />
      </Routes>
    )
  
  function Test() {
    return (<div className='m-20'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
          <UserIcon />
          Username
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>

          <DropdownMenuGroup  >
            <DropdownMenuLabel>Sync</DropdownMenuLabel>
            <DropdownMenuItem>
              <CloudUpload />
              c
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CloudDownloadIcon stroke={'black'}/>
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </DropdownMenuGroup>

          <DropdownMenuGroup>
            <DropdownMenuLabel>Settings</DropdownMenuLabel>
            <DropdownMenuCheckboxItem>
              <Tag />
              Show labels
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </DropdownMenuGroup>

          <DropdownMenuGroup>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem variant='destructive'>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>

        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenuCheckboxesIcons />
    </div>)
  }

function DropdownMenuCheckboxesIcons() {
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Notifications</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notification Preferences</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={notifications.email}
            onCheckedChange={(checked) =>
              setNotifications({ ...notifications, email: checked === true })
            }
          >
            <MailIcon />
            Email notifications
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={notifications.sms}
            onCheckedChange={(checked) =>
              setNotifications({ ...notifications, sms: checked === true })
            }
          >
            <MessageSquareIcon />
            SMS notifications
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={notifications.push}
            onCheckedChange={(checked) =>
              setNotifications({ ...notifications, push: checked === true })
            }
          >
            <BellIcon />
            Push notifications
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
    return (<article>
      <p>This is gonna be a really cool app. Check it out.</p>
      <div><a href="/login" className="btn">Log In</a></div>
      <div><a href="/sign-up">Sign Up</a></div>
    </article>)
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

window.supabase = supabase;
