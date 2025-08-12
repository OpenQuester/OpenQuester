import { Search } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

interface SearchUsersInputProps {
  initialValue?: string;
  placeholder?: string;
  delayMs?: number;
  onSearch: (value: string) => void;
}

export const SearchUsersInput = memo(function SearchUsersInput({
  initialValue = "",
  placeholder = "Search users...",
  delayMs = 300,
  onSearch,
}: SearchUsersInputProps) {
  const [value, setValue] = useState(initialValue);
  const latestCb = useRef(onSearch);
  latestCb.current = onSearch;

  // Debounce
  useEffect(() => {
    const h = setTimeout(() => {
      latestCb.current(value);
    }, delayMs);
    return () => clearTimeout(h);
  }, [value, delayMs]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  return (
    <div className="relative flex-1 max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-mutedText" />
      </div>
      <input
        type="text"
        className="input pl-10"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
});
