import { ChevronRight, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/shared";

export default function Report() {
  const [, setLocation] = useLocation();
  const close = () => setLocation("/room");

  return (
    <div className="flex min-h-full flex-col justify-end bg-slate-900/40 backdrop-blur-sm">
      <section
        className="rounded-t-[30px] bg-white p-6 shadow-[0_-20px_50px_rgba(20,30,50,0.16)]"
        aria-labelledby="report-title"
        data-testid="screen-report"
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mt-6 flex items-center justify-between">
          <h1 id="report-title" className="text-xl font-black">
            Quick report
          </h1>
          <button
            onClick={close}
            className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200"
            aria-label="Close report"
            data-testid="button-close-report"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Mute this participant instantly and log a safety incident.
        </p>

        <div className="mt-5 space-y-2">
          {[
            "Harassment or unsafe conduct",
            "Spam or inappropriate content",
            "Something else",
          ].map((reason) => (
            <button
              onClick={close}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left text-sm font-bold transition-colors hover:bg-slate-50"
              key={reason}
              data-testid={`button-report-${reason.toLowerCase().replaceAll(" ", "-")}`}
            >
              {reason}
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Button secondary onClick={close}>
            Cancel
          </Button>
        </div>
      </section>
    </div>
  );
}