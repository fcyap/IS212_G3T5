import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RecurrencePicker({ value, onChange, disabled = false }) {
  const freq = value?.freq ?? "none";
  const interval = value?.interval ?? 1;

  const handleFreqChange = (next) => {
    if (next === "none") {
      onChange(null);
    } else {
      onChange({ freq: next, interval: interval || 1 });
    }
  };

  const handleIntervalChange = (next) => {
    const parsed = Math.max(1, Number(next) || 1);
    if (!value) {
      onChange({ freq: "daily", interval: parsed });
    } else {
      onChange({ ...value, interval: parsed });
    }
  };

  const label =
    freq === "none"
      ? "Does not repeat"
      : `Repeats every ${interval} ${
          freq === "daily"
            ? interval > 1
              ? "days"
              : "day"
            : freq === "weekly"
            ? interval > 1
              ? "weeks"
              : "week"
            : interval > 1
            ? "months"
            : "month"
        }`;

  return (
    <div className={disabled ? "opacity-60 pointer-events-none" : ""}>
      <label className="block text-xs text-gray-400 mb-1 mt-2">Repeat</label>
      <div className="grid grid-cols-2 gap-2">
        <Select value={freq} onValueChange={handleFreqChange} disabled={disabled}>
          <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
            <SelectValue placeholder="Repeat" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={1}
          value={interval}
          onChange={(event) => handleIntervalChange(event.target.value)}
          className="bg-transparent text-gray-100 border-gray-700"
          disabled={disabled || freq === "none"}
          placeholder="Interval"
        />
      </div>
      <div className="mt-1 text-xs text-gray-400">{label}</div>
    </div>
  );
}
