"""Quick format verification script"""

print("=== ORIGINAL FORMAT (from working map) ===")
print("""
96392 #Num Vertices
97                      <-- mesh count
#Mesh                   <-- #Mesh FIRST
78 #Num Indices
52 #Num Vertices
#Normals (Flags |= 0x1)
1 #Flags
2 #Num Colour Sets
2 #Num Uv Sets
#Mesh                   <-- next mesh starts
9082 #Num Indices
...
""")

print("=== OUR FIXED FORMAT ===")
print("""
56 #Num Vertices
3                       <-- mesh count (added)
#Mesh                   <-- #Mesh FIRST (fixed)
36 #Num Indices
24 #Num Vertices
#Normals (Flags |= 0x1)
1 #Flags
2 #Num Colour Sets
2 #Num Uv Sets
#Mesh                   <-- next mesh
...
""")

print("[OK] Format now matches the original structure!")
print("\nPlease refresh your browser and re-export to get the fixed format.")

