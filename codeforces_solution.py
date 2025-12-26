import numpy as np
arr = np.array([10, 20,30, 40, 50, 60, 70])
arr2 = []
for i in arr:
    arr2.append(int(i))
a = 21
arr -= 21
arr = abs(arr)
arr = list(arr)
minimum = arr.index(min(arr))
if minimum < len(arr) - 1:
    print(arr2[minimum-1])

print(arr2)
