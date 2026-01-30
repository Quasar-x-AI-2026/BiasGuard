class MergeIntervals:
    def comp(self, a, b):
        if a[0] <= b[0]:
            return True
        return False

    def merge(self, intervals):
        if not intervals:
            return []

        # Convert tuples → lists
        intervals = [list(interval) for interval in intervals]

        intervals.sort()

        ans = [intervals[0]]

        for i in range(1, len(intervals)):
            if intervals[i][0] > ans[-1][1]:
                ans.append(intervals[i])
            else:
                ans[-1][1] = max(ans[-1][1], intervals[i][1])
                
        ans = [tuple(interval) for interval in ans]

        return ans


if __name__ == "__main__":
    merger = MergeIntervals()
    intervals = [[1,3],[2,6],[8,10],[15,18]]
    merged_intervals = merger.merge(intervals)
    print("Merged Intervals:", merged_intervals)  # Output: [[1,6],[8,10],[15,18]]