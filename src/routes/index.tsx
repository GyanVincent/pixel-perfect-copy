import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, BookOpen, BarChart3, Zap, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const features = [
  { icon: BookOpen, title: "Smart Question Bank", description: "500+ questions across 4 subjects, categorized by difficulty and Bloom's taxonomy." },
  { icon: Zap, title: "Adaptive Practice", description: "Questions adjust to your performance level for optimal challenge and learning." },
  { icon: BarChart3, title: "Analytics Dashboard", description: "Track your progress, identify weak areas, and see your improvement over time." },
];

function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg sm:text-xl font-bold">SmartPrep</span>
        </div>
        {!isLoading && (
          <Link
            to={isAuthenticated ? "/dashboard" : "/login"}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            {isAuthenticated ? "Dashboard" : "Get Started"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </nav>

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-24 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent mb-6">
            <Zap className="h-3.5 w-3.5" />
            Built for L200 Students
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold leading-tight tracking-tight">
            Ace Your Exams with{" "}
            <span className="gradient-text">Intelligent</span>{" "}
            Preparation
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            SmartPrep combines adaptive practice questions, spaced repetition, and performance analytics to help you study smarter — not harder.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to={isAuthenticated ? "/dashboard" : "/signup"}
              className="inline-flex items-center gap-2 rounded-xl gradient-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90"
            >
              Start Studying Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-7 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-muted"
            >
              Sign In
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="stat-card flex flex-col items-start gap-4"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
                <f.icon className="h-5.5 w-5.5 text-accent" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Subjects */}
      <section className="px-6 pb-24 max-w-5xl mx-auto text-center">
        <h2 className="font-display text-3xl font-bold mb-3">4 Core Subjects</h2>
        <p className="text-muted-foreground mb-10">Comprehensive coverage of your L200 second semester courses</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "Computer Organisation", color: "bg-chart-1/10 text-chart-1" },
            { name: "Multimedia Technology", color: "bg-chart-2/10 text-chart-2" },
            { name: "Data Structures & Algorithms", color: "bg-chart-3/10 text-chart-3" },
            { name: "Entrepreneurship for IT", color: "bg-chart-4/10 text-chart-4" },
          ].map((s) => (
            <div key={s.name} className={`rounded-xl ${s.color} px-5 py-4 text-sm font-semibold`}>
              {s.name}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        SmartPrep © {new Date().getFullYear()} — Built for university students
      </footer>
    </div>
  );
}
