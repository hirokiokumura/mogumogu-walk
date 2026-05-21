import { StepCounter } from "@/components/StepCounter";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <h1 className="text-2xl font-bold mt-4 mb-8">🌈 もぐもぐウォーク</h1>
      <StepCounter />
    </main>
  );
}
