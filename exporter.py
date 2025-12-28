"""
True Skate Map Exporter
Converts our JSON skatepark format to True Skate's native format
"""

import json
import math
import os
import shutil
from dataclasses import dataclass
from typing import List, Tuple

# ========================================
# DATA STRUCTURES
# ========================================

@dataclass
class Vertex:
    """A vertex with position, normal, UV, and color"""
    x: float
    y: float
    z: float
    nx: float = 0.0
    ny: float = 1.0
    nz: float = 0.0
    u: float = 0.0
    v: float = 0.0
    r: int = 255
    g: int = 255
    b: int = 255
    a: int = 255

@dataclass
class Mesh:
    """A mesh with vertices and triangle indices"""
    vertices: List[Vertex]
    indices: List[int]
    material_index: int = 0

# ========================================
# OBJECT GENERATORS
# ========================================

def generate_box(width: float, height: float, depth: float, 
                 offset_x: float = 0, offset_y: float = 0, offset_z: float = 0) -> Mesh:
    """Generate a box mesh"""
    hw, hh, hd = width/2, height/2, depth/2
    
    # 8 corners
    corners = [
        (-hw + offset_x, -hh + offset_y, -hd + offset_z),  # 0: back-bottom-left
        ( hw + offset_x, -hh + offset_y, -hd + offset_z),  # 1: back-bottom-right
        ( hw + offset_x,  hh + offset_y, -hd + offset_z),  # 2: back-top-right
        (-hw + offset_x,  hh + offset_y, -hd + offset_z),  # 3: back-top-left
        (-hw + offset_x, -hh + offset_y,  hd + offset_z),  # 4: front-bottom-left
        ( hw + offset_x, -hh + offset_y,  hd + offset_z),  # 5: front-bottom-right
        ( hw + offset_x,  hh + offset_y,  hd + offset_z),  # 6: front-top-right
        (-hw + offset_x,  hh + offset_y,  hd + offset_z),  # 7: front-top-left
    ]
    
    # Faces: (corner indices, normal)
    faces = [
        ([0, 1, 2, 3], (0, 0, -1)),   # back
        ([5, 4, 7, 6], (0, 0, 1)),    # front
        ([4, 0, 3, 7], (-1, 0, 0)),   # left
        ([1, 5, 6, 2], (1, 0, 0)),    # right
        ([3, 2, 6, 7], (0, 1, 0)),    # top
        ([4, 5, 1, 0], (0, -1, 0)),   # bottom
    ]
    
    vertices = []
    indices = []
    
    for face_corners, normal in faces:
        base = len(vertices)
        for i, ci in enumerate(face_corners):
            c = corners[ci]
            u = 1.0 if i in [1, 2] else 0.0
            v = 1.0 if i in [2, 3] else 0.0
            vertices.append(Vertex(
                x=c[0], y=c[1], z=c[2],
                nx=normal[0], ny=normal[1], nz=normal[2],
                u=u, v=v
            ))
        # Two triangles per face
        indices.extend([base, base+1, base+2, base, base+2, base+3])
    
    return Mesh(vertices=vertices, indices=indices)


def generate_quarter_pipe(radius: float = 3.0, width: float = 6.0, segments: int = 12) -> Mesh:
    """Generate a quarter pipe ramp"""
    vertices = []
    indices = []
    
    # Generate curved surface
    for i in range(segments + 1):
        angle = (math.pi / 2) * (i / segments)
        x = radius * (1 - math.cos(angle))
        y = radius * math.sin(angle)
        
        # Normal points outward from curve center
        nx = -math.cos(angle)
        ny = math.sin(angle)
        
        u = i / segments
        
        # Left edge
        vertices.append(Vertex(
            x=x - radius, y=y, z=-width/2,
            nx=nx, ny=ny, nz=0,
            u=u, v=0
        ))
        # Right edge
        vertices.append(Vertex(
            x=x - radius, y=y, z=width/2,
            nx=nx, ny=ny, nz=0,
            u=u, v=1
        ))
    
    # Create triangles for curved surface
    for i in range(segments):
        base = i * 2
        indices.extend([
            base, base + 2, base + 3,
            base, base + 3, base + 1
        ])
    
    # Add side panels
    side_start = len(vertices)
    
    # Left side
    for i in range(segments + 1):
        angle = (math.pi / 2) * (i / segments)
        x = radius * (1 - math.cos(angle))
        y = radius * math.sin(angle)
        vertices.append(Vertex(x=x - radius, y=y, z=-width/2, nx=0, ny=0, nz=-1, u=x/radius, v=y/radius))
    vertices.append(Vertex(x=-radius, y=0, z=-width/2, nx=0, ny=0, nz=-1, u=0, v=0))
    vertices.append(Vertex(x=0, y=radius, z=-width/2, nx=0, ny=0, nz=-1, u=1, v=1))
    
    # Triangulate left side (fan from bottom-left corner)
    bottom_left = len(vertices) - 2
    for i in range(segments):
        indices.extend([bottom_left, side_start + i, side_start + i + 1])
    
    # Right side (similar but mirrored normal)
    right_start = len(vertices)
    for i in range(segments + 1):
        angle = (math.pi / 2) * (i / segments)
        x = radius * (1 - math.cos(angle))
        y = radius * math.sin(angle)
        vertices.append(Vertex(x=x - radius, y=y, z=width/2, nx=0, ny=0, nz=1, u=x/radius, v=y/radius))
    vertices.append(Vertex(x=-radius, y=0, z=width/2, nx=0, ny=0, nz=1, u=0, v=0))
    vertices.append(Vertex(x=0, y=radius, z=width/2, nx=0, ny=0, nz=1, u=1, v=1))
    
    bottom_right = len(vertices) - 2
    for i in range(segments):
        indices.extend([bottom_right, right_start + i + 1, right_start + i])
    
    return Mesh(vertices=vertices, indices=indices, material_index=1)


def generate_pyramid(base_radius: float = 3.0, height: float = 2.0) -> Mesh:
    """Generate a 4-sided pyramid"""
    vertices = []
    indices = []
    
    # Base corners (square)
    corners = [
        (-base_radius, 0, -base_radius),
        ( base_radius, 0, -base_radius),
        ( base_radius, 0,  base_radius),
        (-base_radius, 0,  base_radius),
    ]
    apex = (0, height, 0)
    
    # Calculate face normals
    def calc_normal(p1, p2, p3):
        # Cross product of two edges
        ax, ay, az = p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]
        bx, by, bz = p3[0]-p1[0], p3[1]-p1[1], p3[2]-p1[2]
        nx = ay*bz - az*by
        ny = az*bx - ax*bz
        nz = ax*by - ay*bx
        length = math.sqrt(nx*nx + ny*ny + nz*nz)
        if length > 0:
            return (nx/length, ny/length, nz/length)
        return (0, 1, 0)
    
    # Four triangular faces
    faces = [
        (0, 1),  # front
        (1, 2),  # right
        (2, 3),  # back
        (3, 0),  # left
    ]
    
    for c1, c2 in faces:
        p1, p2, p3 = corners[c1], corners[c2], apex
        normal = calc_normal(p1, p2, p3)
        
        base = len(vertices)
        vertices.append(Vertex(x=p1[0], y=p1[1], z=p1[2], nx=normal[0], ny=normal[1], nz=normal[2], u=0, v=0))
        vertices.append(Vertex(x=p2[0], y=p2[1], z=p2[2], nx=normal[0], ny=normal[1], nz=normal[2], u=1, v=0))
        vertices.append(Vertex(x=p3[0], y=p3[1], z=p3[2], nx=normal[0], ny=normal[1], nz=normal[2], u=0.5, v=1))
        indices.extend([base, base+1, base+2])
    
    # Bottom face
    base = len(vertices)
    for c in corners:
        vertices.append(Vertex(x=c[0], y=c[1], z=c[2], nx=0, ny=-1, nz=0, u=(c[0]+base_radius)/(2*base_radius), v=(c[2]+base_radius)/(2*base_radius)))
    indices.extend([base, base+2, base+1, base, base+3, base+2])
    
    return Mesh(vertices=vertices, indices=indices, material_index=2)


def generate_rail(length: float = 6.0, height: float = 0.8, radius: float = 0.08) -> Mesh:
    """Generate a flat rail with supports"""
    vertices = []
    indices = []
    segments = 8
    
    # Main rail bar (cylinder along X axis)
    for i in range(segments):
        angle1 = 2 * math.pi * i / segments
        angle2 = 2 * math.pi * (i + 1) / segments
        
        y1 = height + radius * math.cos(angle1)
        z1 = radius * math.sin(angle1)
        y2 = height + radius * math.cos(angle2)
        z2 = radius * math.sin(angle2)
        
        nx1, nz1 = math.cos(angle1), math.sin(angle1)
        nx2, nz2 = math.cos(angle2), math.sin(angle2)
        
        base = len(vertices)
        # Left end
        vertices.append(Vertex(x=-length/2, y=y1, z=z1, nx=0, ny=nx1, nz=nz1, u=0, v=i/segments))
        vertices.append(Vertex(x=-length/2, y=y2, z=z2, nx=0, ny=nx2, nz=nz2, u=0, v=(i+1)/segments))
        # Right end
        vertices.append(Vertex(x=length/2, y=y1, z=z1, nx=0, ny=nx1, nz=nz1, u=1, v=i/segments))
        vertices.append(Vertex(x=length/2, y=y2, z=z2, nx=0, ny=nx2, nz=nz2, u=1, v=(i+1)/segments))
        
        indices.extend([base, base+1, base+3, base, base+3, base+2])
    
    # Support posts
    support_radius = 0.05
    support_positions = [-length/2 + 0.5, length/2 - 0.5]
    
    for sx in support_positions:
        for i in range(segments):
            angle1 = 2 * math.pi * i / segments
            angle2 = 2 * math.pi * (i + 1) / segments
            
            x1 = sx + support_radius * math.cos(angle1)
            z1 = support_radius * math.sin(angle1)
            x2 = sx + support_radius * math.cos(angle2)
            z2 = support_radius * math.sin(angle2)
            
            base = len(vertices)
            # Bottom
            vertices.append(Vertex(x=x1, y=0, z=z1, nx=math.cos(angle1), ny=0, nz=math.sin(angle1), u=0, v=0))
            vertices.append(Vertex(x=x2, y=0, z=z2, nx=math.cos(angle2), ny=0, nz=math.sin(angle2), u=1, v=0))
            # Top
            vertices.append(Vertex(x=x1, y=height, z=z1, nx=math.cos(angle1), ny=0, nz=math.sin(angle1), u=0, v=1))
            vertices.append(Vertex(x=x2, y=height, z=z2, nx=math.cos(angle2), ny=0, nz=math.sin(angle2), u=1, v=1))
            
            indices.extend([base, base+2, base+3, base, base+3, base+1])
    
    return Mesh(vertices=vertices, indices=indices, material_index=3)


def generate_stairs(num_steps: int = 3, step_height: float = 0.4, 
                    step_depth: float = 1.0, step_width: float = 3.0) -> Mesh:
    """Generate stairs"""
    all_vertices = []
    all_indices = []
    
    for i in range(num_steps):
        # Each step is a box
        box = generate_box(
            width=step_width,
            height=step_height,
            depth=step_depth,
            offset_x=0,
            offset_y=step_height * (i + 0.5),
            offset_z=-step_depth * i
        )
        
        # Add to combined mesh
        base = len(all_vertices)
        all_vertices.extend(box.vertices)
        all_indices.extend([idx + base for idx in box.indices])
    
    return Mesh(vertices=all_vertices, indices=all_indices, material_index=1)


def generate_ledge(length: float = 5.0, height: float = 0.6, depth: float = 0.8) -> Mesh:
    """Generate a ledge with metal coping"""
    box = generate_box(length, height, depth, offset_y=height/2)
    box.material_index = 1
    return box


def generate_kicker(length: float = 2.0, height: float = 1.5, width: float = 3.0) -> Mesh:
    """Generate a kicker ramp"""
    vertices = []
    indices = []
    
    # Curved surface using quadratic bezier approximation
    segments = 8
    for i in range(segments + 1):
        t = i / segments
        # Quadratic bezier: (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        x = (1-t)**2 * 0 + 2*(1-t)*t * (length*0.75) + t**2 * length
        y = (1-t)**2 * 0 + 2*(1-t)*t * 0 + t**2 * height
        
        # Approximate normal
        dx = 2*(1-t)*(length*0.75 - 0) + 2*t*(length - length*0.75)
        dy = 2*t*height
        length_n = math.sqrt(dx*dx + dy*dy)
        if length_n > 0:
            nx, ny = -dy/length_n, dx/length_n
        else:
            nx, ny = 0, 1
        
        u = t
        
        vertices.append(Vertex(x=x, y=y, z=-width/2, nx=nx, ny=ny, nz=0, u=u, v=0))
        vertices.append(Vertex(x=x, y=y, z=width/2, nx=nx, ny=ny, nz=0, u=u, v=1))
    
    for i in range(segments):
        base = i * 2
        indices.extend([base, base+2, base+3, base, base+3, base+1])
    
    # Bottom face
    base = len(vertices)
    vertices.append(Vertex(x=0, y=0, z=-width/2, nx=0, ny=-1, nz=0, u=0, v=0))
    vertices.append(Vertex(x=0, y=0, z=width/2, nx=0, ny=-1, nz=0, u=0, v=1))
    vertices.append(Vertex(x=length, y=0, z=width/2, nx=0, ny=-1, nz=0, u=1, v=1))
    vertices.append(Vertex(x=length, y=0, z=-width/2, nx=0, ny=-1, nz=0, u=1, v=0))
    indices.extend([base, base+1, base+2, base, base+2, base+3])
    
    # Back face
    base = len(vertices)
    vertices.append(Vertex(x=length, y=0, z=-width/2, nx=1, ny=0, nz=0, u=0, v=0))
    vertices.append(Vertex(x=length, y=0, z=width/2, nx=1, ny=0, nz=0, u=1, v=0))
    vertices.append(Vertex(x=length, y=height, z=width/2, nx=1, ny=0, nz=0, u=1, v=1))
    vertices.append(Vertex(x=length, y=height, z=-width/2, nx=1, ny=0, nz=0, u=0, v=1))
    indices.extend([base, base+1, base+2, base, base+2, base+3])
    
    return Mesh(vertices=vertices, indices=indices, material_index=4)


def generate_manual_pad(length: float = 4.0, height: float = 0.3, width: float = 2.0) -> Mesh:
    """Generate a manual pad"""
    box = generate_box(length, height, width, offset_y=height/2)
    box.material_index = 1
    return box


def generate_bench() -> Mesh:
    """Generate a bench"""
    all_vertices = []
    all_indices = []
    
    # Seat
    seat = generate_box(2.0, 0.1, 0.5, offset_y=0.5)
    all_vertices.extend(seat.vertices)
    all_indices.extend(seat.indices)
    
    # Legs
    for x_offset in [-0.8, 0.8]:
        base = len(all_vertices)
        leg = generate_box(0.1, 0.5, 0.5, offset_x=x_offset, offset_y=0.25)
        all_vertices.extend(leg.vertices)
        all_indices.extend([idx + base for idx in leg.indices])
    
    return Mesh(vertices=all_vertices, indices=all_indices, material_index=5)


def generate_ground_flat(size: float = 10.0) -> Mesh:
    """Generate flat ground"""
    box = generate_box(size, 0.5, size, offset_y=-0.25)
    box.material_index = 0
    return box


def generate_slope(length: float = 5.0, height: float = 2.0, width: float = 5.0) -> Mesh:
    """Generate a slope/bank"""
    vertices = []
    indices = []
    
    # Top surface (angled)
    vertices.append(Vertex(x=0, y=0, z=-width/2, nx=0, ny=0.894, nz=-0.447, u=0, v=0))
    vertices.append(Vertex(x=0, y=0, z=width/2, nx=0, ny=0.894, nz=-0.447, u=0, v=1))
    vertices.append(Vertex(x=length, y=height, z=width/2, nx=0, ny=0.894, nz=-0.447, u=1, v=1))
    vertices.append(Vertex(x=length, y=height, z=-width/2, nx=0, ny=0.894, nz=-0.447, u=1, v=0))
    indices.extend([0, 1, 2, 0, 2, 3])
    
    # Bottom
    base = len(vertices)
    vertices.append(Vertex(x=0, y=0, z=-width/2, nx=0, ny=-1, nz=0, u=0, v=0))
    vertices.append(Vertex(x=0, y=0, z=width/2, nx=0, ny=-1, nz=0, u=0, v=1))
    vertices.append(Vertex(x=length, y=0, z=width/2, nx=0, ny=-1, nz=0, u=1, v=1))
    vertices.append(Vertex(x=length, y=0, z=-width/2, nx=0, ny=-1, nz=0, u=1, v=0))
    indices.extend([base, base+2, base+1, base, base+3, base+2])
    
    # Back
    base = len(vertices)
    vertices.append(Vertex(x=length, y=0, z=-width/2, nx=1, ny=0, nz=0, u=0, v=0))
    vertices.append(Vertex(x=length, y=0, z=width/2, nx=1, ny=0, nz=0, u=1, v=0))
    vertices.append(Vertex(x=length, y=height, z=width/2, nx=1, ny=0, nz=0, u=1, v=1))
    vertices.append(Vertex(x=length, y=height, z=-width/2, nx=1, ny=0, nz=0, u=0, v=1))
    indices.extend([base, base+1, base+2, base, base+2, base+3])
    
    # Sides
    base = len(vertices)
    vertices.append(Vertex(x=0, y=0, z=-width/2, nx=0, ny=0, nz=-1, u=0, v=0))
    vertices.append(Vertex(x=length, y=0, z=-width/2, nx=0, ny=0, nz=-1, u=1, v=0))
    vertices.append(Vertex(x=length, y=height, z=-width/2, nx=0, ny=0, nz=-1, u=1, v=1))
    indices.extend([base, base+1, base+2])
    
    base = len(vertices)
    vertices.append(Vertex(x=0, y=0, z=width/2, nx=0, ny=0, nz=1, u=0, v=0))
    vertices.append(Vertex(x=length, y=height, z=width/2, nx=0, ny=0, nz=1, u=1, v=1))
    vertices.append(Vertex(x=length, y=0, z=width/2, nx=0, ny=0, nz=1, u=1, v=0))
    indices.extend([base, base+1, base+2])
    
    return Mesh(vertices=vertices, indices=indices, material_index=1)


# ========================================
# OBJECT TYPE MAPPING
# ========================================

OBJECT_GENERATORS = {
    'ground-flat': generate_ground_flat,
    'ground-slope': generate_slope,
    'quarter-pipe': generate_quarter_pipe,
    'half-pipe': lambda: generate_quarter_pipe(),  # Simplified for now
    'kicker': generate_kicker,
    'pyramid': generate_pyramid,
    'rail-flat': generate_rail,
    'rail-down': generate_rail,  # TODO: add angle
    'ledge': generate_ledge,
    'manual-pad': generate_manual_pad,
    'stairs-3': lambda: generate_stairs(3),
    'stairs-5': lambda: generate_stairs(5),
    'stairs-hubba': lambda: generate_stairs(4),
    'bench': generate_bench,
    'trash-can': lambda: generate_box(0.6, 0.8, 0.6, offset_y=0.4),  # Simplified
}

# ========================================
# TRANSFORM HELPERS
# ========================================

def transform_vertex(v: Vertex, pos: dict, rot: dict, scale: float) -> Vertex:
    """Apply position, rotation (Y-axis), and scale to a vertex"""
    # Scale
    x = v.x * scale
    y = v.y * scale
    z = v.z * scale
    
    # Rotate around Y axis
    angle = rot.get('y', 0)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    
    new_x = x * cos_a - z * sin_a
    new_z = x * sin_a + z * cos_a
    
    # Rotate normal too
    new_nx = v.nx * cos_a - v.nz * sin_a
    new_nz = v.nx * sin_a + v.nz * cos_a
    
    # Translate (True Skate uses different coordinate scale - multiply by 100)
    ts_scale = 100.0
    final_x = (new_x + pos.get('x', 0)) * ts_scale
    final_y = (y + pos.get('y', 0)) * ts_scale
    final_z = (new_z + pos.get('z', 0)) * ts_scale
    
    return Vertex(
        x=final_x, y=final_y, z=final_z,
        nx=new_nx, ny=v.ny, nz=new_nz,
        u=v.u, v=v.v,
        r=v.r, g=v.g, b=v.b, a=v.a
    )


# ========================================
# TRUE SKATE FORMAT WRITER
# ========================================

def write_trueskate_txt(meshes: List[Mesh], textures: List[str], output_path: str):
    """Write the True Skate .txt geometry file"""
    
    # Count total vertices
    total_vertices = sum(len(m.vertices) for m in meshes)
    
    lines = []
    
    # Header - BASK magic bytes
    lines.extend(['84', '65', '83', '75'])
    lines.append('1003 #Version')
    lines.append('<VIS ')
    lines.append('17')
    
    # Textures
    lines.append(f'{len(textures)} #Num Textures')
    for tex in textures:
        lines.append(tex)
    
    # Materials
    num_materials = 6
    lines.append(f'{num_materials} #Num Materials')
    
    material_colors = [
        (128, 128, 130),  # 0: Ground - gray concrete
        (100, 100, 105),  # 1: Ramps - darker gray
        (85, 85, 90),     # 2: Pyramid - medium gray
        (180, 180, 180),  # 3: Rails - metallic
        (136, 85, 51),    # 4: Kicker - wood brown
        (139, 69, 19),    # 5: Bench - wood
    ]
    
    for i, (r, g, b) in enumerate(material_colors):
        lines.append('#Material')
        lines.append('1 #Material Type (Solid)')
        lines.append('#Color')
        lines.extend([str(r), str(g), str(b), '255'])
        lines.append('1.000000 #Specular')
        lines.append('5.000000 #G Blend Sharpness')
        lines.append('0.800000 #G Blend Level')
        lines.append('0.500000 #G Blend Mode')
        lines.append('#G Shadow Color')
        lines.extend(['180', '180', '180', '255'])
        lines.append('#G Highlight Color')
        lines.extend(['255', '255', '255', '255'])
        lines.append('0 #Texture index')
        lines.append('0')
        lines.append('0')
    
    # Total vertices
    lines.append(f'{total_vertices} #Num Vertices')
    
    # Meshes
    for mesh in meshes:
        lines.append(f'{len(mesh.indices)} #Num Indices')
        lines.append(f'{len(mesh.vertices)} #Num Vertices')
        lines.append('#Normals (Flags |= 0x1)')
        lines.append('1 #Flags')
        lines.append('2 #Num Colour Sets')
        lines.append('2 #Num Uv Sets')
        lines.append('#Mesh')
    
    # Vertex data
    for mesh in meshes:
        for v in mesh.vertices:
            # Normal
            lines.append(f'{v.nx:.6f}')
            lines.append(f'{v.ny:.6f}')
            lines.append(f'{v.nz:.6f}')
            # Position
            lines.append(f'{v.x:.6f}')
            lines.append(f'{v.y:.6f}')
            lines.append(f'{v.z:.6f}')
            # UV set 1
            lines.append(f'{v.u:.6f}')
            lines.append(f'{v.v:.6f}')
            # UV set 2 (lightmap - same as UV1 for now)
            lines.append(f'{v.u:.6f}')
            lines.append(f'{v.v:.6f}')
            # Color set 1
            lines.extend([str(v.r), str(v.g), str(v.b), str(v.a)])
            # Color set 2
            lines.extend(['255', '255', '255', '255'])
    
    # Indices
    for mesh in meshes:
        for idx in mesh.indices:
            lines.append(str(idx))
    
    # Write file
    with open(output_path, 'w') as f:
        f.write('\n'.join(lines))
    
    print(f"Wrote {output_path} ({len(lines)} lines)")


def write_mod_json(name: str, txt_filename: str, output_path: str):
    """Write the _mod.json metadata file"""
    
    mod_data = f'''"modWorldInfo":
{{
\t"name":"{name}",
\t"fileName":"{txt_filename}"
\t"startPositions":
\t[
\t\t\t"startPosition":
\t\t\t{{ 
\t\t\t\t"x":0.0, 
\t\t\t\t"y":0.0, 
\t\t\t\t"z":5.0
\t\t\t\t"angle":0.0
\t\t\t}}
\t\t\t"startPosition":
\t\t\t{{ 
\t\t\t\t"x":10.0, 
\t\t\t\t"y":0.0, 
\t\t\t\t"z":0.0
\t\t\t\t"angle":90.0
\t\t\t}}
\t],
\t"skyBoxUp":"sky_top.jpg"
\t"skyBoxForward":"sky_front.jpg"
\t"skyBoxBack":"sky_back.jpg"
\t"skyBoxLeft":"sky_left.jpg"
\t"skyBoxRight":"sky_right.jpg"

\t"specularBoxUp":"sky_top.jpg"
\t"specularBoxForward":"sky_front.jpg"
\t"specularBoxBack":"sky_back.jpg"
\t"specularBoxLeft":"sky_left.jpg"
\t"specularBoxRight":"sky_right.jpg"
\t"specularBoxDown":"sky_bottom.jpg"

\t"skyAngle":90.0
\t"gamma":1.0

\t"colorBackground": {{ "r": 0.5, "g": 0.7, "b": 1.0 }},
\t"colorLightingDirect": {{ "r": 1.0, "g": 0.95, "b": 0.9}},
\t"colorLightingAmbient": {{ "r": 0.4, "g": 0.45, "b": 0.5}},
\t"lightDirection": {{ "x": 45.0, "y": 60.0, "z":180.0 }}
}}'''
    
    with open(output_path, 'w') as f:
        f.write(mod_data)
    
    print(f"Wrote {output_path}")


# ========================================
# MAIN EXPORT FUNCTION
# ========================================

def export_skatepark(json_path: str, output_dir: str):
    """Export a skatepark JSON to True Skate format"""
    
    # Load JSON
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    park_name = data.get('name', 'My Skatepark')
    objects = data.get('objects', [])
    
    print(f"Exporting '{park_name}' with {len(objects)} objects...")
    
    # Create output directory
    safe_name = park_name.replace(' ', '_').lower()
    output_path = os.path.join(output_dir, safe_name)
    os.makedirs(output_path, exist_ok=True)
    
    # Generate meshes for each object
    all_meshes = []
    
    # Add a ground plane first
    ground = generate_ground_flat(50.0)
    ground_mesh = Mesh(
        vertices=[transform_vertex(v, {'x': 0, 'y': -0.25, 'z': 0}, {'y': 0}, 1.0) for v in ground.vertices],
        indices=ground.indices,
        material_index=0
    )
    all_meshes.append(ground_mesh)
    
    for obj in objects:
        obj_type = obj.get('type', 'ground-flat')
        pos = obj.get('position', {'x': 0, 'y': 0, 'z': 0})
        rot = obj.get('rotation', {'y': 0})
        scale = obj.get('scale', 1.0)
        
        generator = OBJECT_GENERATORS.get(obj_type)
        if generator:
            mesh = generator()
            
            # Transform vertices
            transformed_verts = [transform_vertex(v, pos, rot, scale) for v in mesh.vertices]
            
            all_meshes.append(Mesh(
                vertices=transformed_verts,
                indices=mesh.indices,
                material_index=mesh.material_index
            ))
            print(f"  + {obj_type} at ({pos['x']}, {pos['y']}, {pos['z']})")
        else:
            print(f"  ! Unknown object type: {obj_type}")
    
    # Textures (simplified - just one for now)
    textures = ['concrete_gray']
    
    # Write files
    txt_filename = f'{safe_name}.txt'
    write_trueskate_txt(all_meshes, textures, os.path.join(output_path, txt_filename))
    write_mod_json(park_name, txt_filename, os.path.join(output_path, '_mod.json'))
    
    # Copy default textures (create placeholder)
    placeholder_texture = os.path.join(output_path, 'concrete_gray.jpg')
    if not os.path.exists(placeholder_texture):
        # Create a simple gray image placeholder note
        with open(os.path.join(output_path, 'TEXTURES_NEEDED.txt'), 'w') as f:
            f.write("Add the following texture files to this folder:\n")
            f.write("- concrete_gray.jpg (gray concrete texture)\n")
            f.write("- sky_top.jpg, sky_front.jpg, sky_back.jpg, sky_left.jpg, sky_right.jpg (skybox)\n")
    
    print(f"\n[OK] Export complete! Files saved to: {output_path}")
    print(f"   - {txt_filename} (geometry)")
    print(f"   - _mod.json (metadata)")
    print(f"\nNext steps:")
    print(f"1. Add texture files to the folder")
    print(f"2. Zip the folder contents")
    print(f"3. Upload to mod.io or transfer to your phone")
    
    return output_path


# ========================================
# CLI
# ========================================

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python exporter.py <skatepark.json> [output_dir]")
        print("\nExample: python exporter.py skatepark.json ./output")
        sys.exit(1)
    
    json_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else './output'
    
    export_skatepark(json_file, output_dir)

