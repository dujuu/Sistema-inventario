import Sidebar from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-60 overflow-auto">
        <main className="p-10 min-h-full">{children}</main>
      </div>
    </div>
  );
}
