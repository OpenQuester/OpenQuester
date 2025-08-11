import { type ReactNode } from "react";

interface ErrorNoticeProps {
  title: string;
  message: string;
  icon?: ReactNode;
}

export const ErrorNotice = ({ title, message, icon }: ErrorNoticeProps) => (
  <div className="card">
    <div className="p-6">
      <div className="flex items-center space-x-3">
        {icon && (
          <div className="w-10 h-10 rounded-full bg-error-100 flex items-center justify-center">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium text-error-800">{title}</h3>
          <p className="text-sm text-error-600 mt-1">{message}</p>
        </div>
      </div>
    </div>
  </div>
);
