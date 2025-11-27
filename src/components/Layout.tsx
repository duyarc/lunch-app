import React from 'react';

interface LayoutProps {
    children: React.ReactNode;
    hideHeader?: boolean;
}

export function Layout({ children, hideHeader = false }: LayoutProps) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {!hideHeader && (
                <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                    <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                            Trưa nay ăn gì?
                        </h1>
                    </div>
                </header>
            )}
            <main className="max-w-md mx-auto px-4 py-6 space-y-6">
                {children}
            </main>
        </div>
    );
}
