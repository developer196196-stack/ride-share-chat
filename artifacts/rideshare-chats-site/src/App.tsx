import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronDown, Menu, X } from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import './landing.css';

const queryClient = new QueryClient();

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mood, setMood] = useState('Party Mode');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const moods = ['Party Mode', 'Networking', 'Deep Talk'];
  const faqItems = [
    ['Is Ride Share Chats for people at home?', 'No. It is imagined for verified passengers sharing the same ride. The room is tied to a trip, not a place to drop in from home.'],
    ['Why nine people in a room?', 'Nine is a concept-sized room: enough people for different points of view, but small enough that everyone can still feel part of the conversation.'],
    ['What happens if my car stops in traffic?', 'This is still a concept, but the room would be designed around a ride in progress. A pause in traffic should not suddenly turn into a social obligation.'],
    ['Can I leave a room without making it awkward?', 'Yes. Leaving should be as easy and quiet as arriving. The idea is to offer a simple “Next” exit, without asking you to explain yourself.'],
  ];
  const closeMenu = () => setMenuOpen(false);
  return (
    <div className="site-shell">
      <header className="topbar">
        <a href="#top" className="wordmark" aria-label="Ride Share Chats home" onClick={closeMenu}>
          <span className="wordmark-symbol">r<span>s</span></span>
          <span className="wordmark-copy"><b>Ride Share</b><em>Chats</em></span>
        </a>
        <nav className={`nav-links ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#how" onClick={closeMenu}>The idea</a>
          <a href="#rooms" onClick={closeMenu}>Room moods</a>
          <a href="#trust" onClick={closeMenu}>The room</a>
          <a href="#faq" onClick={closeMenu}>Good to know</a>
          <a className="nav-cta" href="#preview" onClick={closeMenu}>See the preview <ArrowUpRight size={13}/></a>
        </nav>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <span className="eyebrow"><i/> A little idea for the ride you’re already taking</span>
            <h1>Meet people<br/>from <span className="red-word">your</span><br/><span className="blue-word">backseat.</span></h1>
            <p className="hero-intro">A live video room for verified riders sharing a ride. Less staring at your phone. More chance of a good hello.</p>
            <div className="hero-actions">
              <a className="pill-button red-button" href="#rooms">Take a look <ArrowRight size={15}/></a>
              <span className="micro-copy">Passenger-only. Ride-sized. Just a concept for now.</span>
            </div>
            <a className="scroll-cue" href="#how"><span>Scroll to meet the idea</span><ArrowDown size={13}/></a>
          </div>
          <div className="hero-art" aria-label="Preview of a small passenger room">
            <div className="art-note note-a">a room for<br/>the road ahead</div>
            <div className="hero-room">
              <div className="room-topline"><span>YOUR RIDE ROOM</span><span className="live-dot">CONCEPT</span></div>
              <div className="room-title">{mood}<small>9 seats · same ride</small></div>
              <div className="mini-seats">
                {['M','J','A','S','L','R','N','T','You'].map((label,i)=><div className={`mini-seat seat-${i}`} key={label}><span className={`person person-${i%4}`}/><small>{label}</small></div>)}
              </div>
              <div className="room-bottom"><span className="room-wave"><i/><i/><i/><i/><i/><i/><i/></span><span>room opens as your ride begins</span></div>
            </div>
            <span className="scribble scribble-one">hello, stranger</span>
            <span className="tiny-star star-one" aria-hidden="true" />
            <span className="tiny-star star-two" aria-hidden="true" />
          </div>
        </section>

        <div className="red-marquee" aria-label="A better kind of small talk">
          <div className="marquee-track"><span>A little less scroll</span><b>✳</b><span>A lot more hello</span><b>✳</b><span>Make the ride feel shorter</span><b>✳</b><span>A little less scroll</span><b>✳</b><span>A lot more hello</span><b>✳</b></div>
        </div>

        <section className="idea-section section-wrap" id="how">
          <div className="section-heading">
            <span className="eyebrow"><i/> THE IDEA, IN A FEW WORDS</span>
            <h2>A little less<br/><span className="red-word">scroll.</span><br/>A lot more<br/><span className="red-word">hello.</span></h2>
            <p className="fineprint">The ride is already a shared moment.<br/>What if it felt a little less like waiting?</p>
          </div>
          <div className="idea-copy">
            <p className="lead-serif">Every ride has a strange pocket of time. You are not at home. You are not quite where you’re going. You are just there, moving through the city with a few people you will probably never meet again.</p>
            <p>Ride Share Chats is a concept for giving that in-between time a little more possibility. A small live video room, made up of verified passengers travelling together.</p>
            <p>No endless feed. No pressure to perform. Just an optional hello, while you’re already headed somewhere.</p>
            <a className="text-link" href="#trust">A room built around the ride <ArrowRight size={13}/></a>
            <div className="idea-footnote"><span className="foot-icon">↗</span><span>The best conversations are usually the ones you didn’t plan.</span></div>
          </div>
          <div className="idea-rhythm">
            <span><i className="dot dot-red"/>Same ride</span><span><i className="dot dot-blue"/>Verified riders</span><span><i className="dot dot-yellow"/>A moment to meet</span>
          </div>
        </section>

        <section className="mood-section" id="rooms">
          <div className="section-wrap mood-inner">
            <div className="section-heading">
              <span className="eyebrow"><i/> MAKE IT YOURS</span>
              <h2>Your mood<br/><span className="red-word">sets the room.</span></h2>
              <p className="fineprint">Different rides call for different conversations. Pick a mood, and the room follows.</p>
              <div className="mood-tabs" role="tablist" aria-label="Choose a room mood">
                {moods.map((item)=><button type="button" role="tab" aria-selected={mood===item} className={mood===item?'active':''} key={item} onClick={()=>setMood(item)}>{item}<span>{mood===item?'↗':'+'}</span></button>)}
              </div>
            </div>
            <div className={`mood-preview ${mood==='Party Mode'?'party':mood==='Networking'?'networking':'deep'}`} role="tabpanel">
              <span className="preview-label">A ROOM COULD FEEL LIKE</span>
              <div className="preview-artwork">
                <div className="preview-orbit orbit-a"/><div className="preview-orbit orbit-b"/>
                <span className="preview-overline">RIDE ROOM Nº 09</span>
                <h3>{mood}</h3>
                <p>{mood==='Party Mode'?'Good energy. No agenda.':mood==='Networking'?'Good people going places.':'A little space to really talk.'}</p>
                <div className="preview-footer"><span className="mood-mark">rs.</span><span>same ride, different vibe</span><ArrowUpRight size={15}/></div>
              </div>
              <p className="preview-caption">An early look at how a room mood might shape the conversation.</p>
            </div>
          </div>
        </section>

        <section className="human-section section-wrap" id="preview">
          <div className="section-heading">
            <span className="eyebrow"><i/> SMALL BY DESIGN</span>
            <h2>Small enough<br/>to feel <span className="red-word">human.</span></h2>
            <p className="fineprint">Nine seats. One shared ride.<br/>A room you can actually get to know.</p>
          </div>
          <div className="human-demo">
            <div className="demo-window">
              <div className="demo-header"><span>Ride Share Chats <b>·</b> Party Mode</span><span className="demo-live"><i/> ROOM PREVIEW</span></div>
              <div className="seat-grid">
                {[
                  ['Maya','Brooklyn'],['Jonah','Queens'],['Ari','On the way'],['Sam','Manhattan'],
                  ['Lee','Williamsburg'],['Rae','On the way'],['Nico','Greenpoint'],['Tess','Astoria'],['You','Your seat'],
                ].map(([name,place],i)=><div className={`seat-card seat-card-${i}`} key={name}>
                  <div className={`seat-portrait portrait-${i}`}><span className="portrait-head"/><span className="portrait-body"/></div>
                  <div className="seat-name">{name}{name==='You'&&<span className="you-tag">YOU</span>}</div><small>{place}</small>
                </div>)}
              </div>
              <div className="demo-controls"><span className="sound-bars" aria-hidden="true"><i/><i/><i/><i/><i/></span><span>Room is just getting started</span><span className="demo-mic" aria-hidden="true"><span/></span></div>
            </div>
            <div className="demo-caption"><span className="caption-mark">↗</span><p><b>Small enough to feel like a room.</b><br/>Not another crowd to shout over.</p><span className="caption-stamp">9 SEATS<br/>ONE RIDE</span></div>
          </div>
          <div className="human-note"><b>01</b><span>A room that begins with the ride — not an algorithm.</span><ArrowRight size={14}/></div>
        </section>

        <section className="trust-section" id="trust">
          <div className="section-wrap trust-inner">
            <div className="section-heading">
              <span className="eyebrow light"><i/> THE IMPORTANT PART</span>
              <h2>The room starts<br/>with a <span className="yellow-word">real ride.</span></h2>
              <p>A thoughtful room begins with the ride itself. Three signals could help make sure a passenger belongs there.</p>
              <a className="pill-button light-button" href="#faq">How it could work <ArrowRight size={14}/></a>
            </div>
            <div className="entry-card">
              <div className="entry-card-head"><span><i/> ENTRY SIGNAL CHECK</span><b>CONCEPT · NOT LIVE</b></div>
              <div className="entry-card-title">A room begins<br/>with the ride.</div>
              <div className="entry-checks">
                <div className="entry-check"><span className="entry-icon motion-icon"><i/><i/><i/></span><span className="entry-label"><b>Motion signal</b><small>Is the trip in motion?</small></span><span className="entry-state">LOOKING GOOD <i/></span></div>
                <div className="entry-check"><span className="entry-icon texture-icon"><i/></span><span className="entry-label"><b>Ride texture</b><small>Does this feel like a real ride?</small></span><span className="entry-state">MATCHES <i/></span></div>
                <div className="entry-check"><span className="entry-icon trip-icon"><i/></span><span className="entry-label"><b>Trip confirmation</b><small>Are riders on the same trip?</small></span><span className="entry-state">CONFIRMED <i/></span></div>
              </div>
              <div className="entry-card-foot"><span>PASSENGER-ONLY BY DESIGN</span><span>01 — 03</span></div>
            </div>
          </div>
        </section>

        <section className="next-section section-wrap">
          <div className="orbit-art" aria-hidden="true">
            <div className="orbit-ring ring-1"/><div className="orbit-ring ring-2"/><div className="orbit-ring ring-3"/>
            <div className="orbit-core"><span>next</span><i/></div>
            <span className="orbit-dot dot-a"/><span className="orbit-dot dot-b"/><span className="orbit-dot dot-c"/>
            <span className="orbit-note">THE RIDE<br/>KEEPS GOING</span>
          </div>
          <div className="section-heading">
            <span className="eyebrow"><i/> AND IF IT’S NOT YOUR THING</span>
            <h2>Not your<br/><span className="red-word">room?</span></h2>
            <p className="fineprint next-copy">There is no polite way to disappear from a conversation you are done with. So we made one: <span>Next.</span></p>
            <a className="text-link" href="#faq">A few more things worth knowing <ArrowRight size={13}/></a>
          </div>
        </section>

        <section className="yellow-section">
          <div className="section-wrap yellow-inner">
            <div>
              <span className="eyebrow"><i/> A SMALL THOUGHT FOR THE ROAD</span>
              <h2>The ride is<br/><span>already</span><br/>happening.</h2>
            </div>
            <div className="yellow-copy">
              <p>Maybe the best part of your next ride isn’t a faster route. Maybe it’s a conversation you didn’t expect to have.</p>
              <p>Ride Share Chats is an early concept about making a little room for that — one shared trip at a time.</p>
              <a className="pill-button red-button" href="#preview">Explore the room preview <ArrowRight size={14}/></a>
              <small><b>No account. No signup.</b> Just a concept — no live rooms yet.</small>
            </div>
          </div>
        </section>

        <section className="faq-section section-wrap" id="faq">
          <div className="section-heading">
            <span className="eyebrow"><i/> THE SHORT VERSION</span>
            <h2>Good to<br/><span className="red-word">know.</span></h2>
            <p className="fineprint">A few things people tend to wonder about the idea.</p>
          </div>
          <div className="faq-list">
            {faqItems.map(([question,answer],i)=><article className={`faq-item ${openFaq===i?'faq-open':''}`} key={question}>
              <button type="button" aria-expanded={openFaq===i} aria-controls={`faq-answer-${i}`} onClick={()=>setOpenFaq(openFaq===i?null:i)}><span>{question}</span><ChevronDown size={16}/></button>
              <div className="faq-answer" id={`faq-answer-${i}`} hidden={openFaq!==i}><p>{answer}</p></div>
            </article>)}
          </div>
        </section>
      </main>
      <footer className="footer section-wrap">
        <a href="#top" className="wordmark footer-brand"><span className="wordmark-symbol">r<span>s</span></span><span className="wordmark-copy"><b>Ride Share</b><em>Chats</em></span></a>
        <p>A small idea about the space between here and there.</p>
        <a className="back-top" href="#top">Back to the top <ArrowUpRight size={13}/></a>
        <div className="footer-legal"><span>© Ride Share Chats · Concept stage</span><span>Made for the ride between.</span></div>
      </footer>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
