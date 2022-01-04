import cv2
import math
import numpy as np
import puz
import sys

# Dimensions of the grid
SIZES = {
    "ROWS": None,
    "COLS": None,
    "CELL_SIZE": 40,
    "BORDER": 0,
    "GRID_LINE": 4,
    "PUZZLE_HEIGHT": None,
    "PUZZLE_WIDTH": None, 
}

# Colors of the grid
WHITE = [255, 255, 255]
BLACK = [0, 0, 0]
BORDER_COLOR = [80, 80, 80]


# Pad an array so that it's square or almost square.
# This method will only add padding in equal amounts so (ex.) a 15x16 would
# remain unchanged.
def pad_array(a):
    extra = abs(SIZES["ROWS"] - SIZES["COLS"]) // 2
    if extra == 0:
        return a

    # Add extra rows
    if SIZES["ROWS"] < SIZES["COLS"]:
        row = ["."] * SIZES["COLS"]
        new = []
        for _ in range(extra):
            new.append(row)
        for e in a:
            new.append(e)
        for _ in range(extra):
            new.append(row)

    # Add extra cols
    if SIZES["COLS"] < SIZES["ROWS"]:
        new = []
        padding = ["."] * extra
        for e in a:
            new_row = padding + e + padding
            new.append(new_row)

    # The size of the puzzle has now changed, so update the dict
    SIZES["ROWS"] = len(new)
    SIZES["COLS"] = len(new[0])
    SIZES["PUZZLE_HEIGHT"] = (
        (SIZES["BORDER"] * 2) + 
        (SIZES["CELL_SIZE"] * SIZES["ROWS"]) + 
        ((SIZES["ROWS"] - 1) * SIZES["GRID_LINE"]))
    SIZES["PUZZLE_WIDTH"] = (
        (SIZES["BORDER"] * 2) + 
        (SIZES["CELL_SIZE"] * SIZES["COLS"]) + 
        ((SIZES["COLS"] - 1) * SIZES["GRID_LINE"]))

    return new


# Parse the puz file and return a 2d near-square array of letters and .s
def read_puzzle():
    array = [[0] * SIZES["COLS"] for _ in range(SIZES["ROWS"])]
    for i in range(SIZES["ROWS"]):
        for j in range(SIZES["COLS"]):
            array[i][j] = PUZZLE.solution[(i * SIZES["COLS"]) + j]

    padded_array = pad_array(array)
    return padded_array


# Draw a single cell of the puzzle
def draw_cell(color, number):
    size = SIZES["CELL_SIZE"]
    cell = np.zeros((size, size, 3), dtype=np.uint)
    cell[:, :] = color

    if number in CIRCLED_SQUARES:
        origin = size // 2
        for i in range(size):
            for j in range(size):
                dist_to_orig = math.sqrt((i - origin) ** 2 + (j - origin) ** 2)
                diff = abs(math.floor(dist_to_orig) - math.floor(origin))
                if diff < (SIZES["GRID_LINE"] / 2):
                    cell[i, j] = BORDER_COLOR

    return cell


# Draw a puzzle with the specified sizes and colors
def draw_puzzle(p):

    # Initialize the blank image
    image = np.zeros((SIZES["PUZZLE_HEIGHT"], SIZES["PUZZLE_WIDTH"], 3), dtype=np.uint8)
    image[:, :] = BORDER_COLOR

    # Fill in each cell of the puzzle
    for r in range(SIZES["ROWS"]):
        for c in range(SIZES["COLS"]):
            color = BLACK if p[r][c] == "." else WHITE
            cell = draw_cell(color, (r * SIZES["COLS"]) + c)
            r_start = SIZES["BORDER"] + (SIZES["CELL_SIZE"] * r) + (r * SIZES["GRID_LINE"])
            r_stop = r_start + SIZES["CELL_SIZE"]
            c_start = SIZES["BORDER"] + (SIZES["CELL_SIZE"] * c) + (c * SIZES["GRID_LINE"])
            c_stop = c_start + SIZES["CELL_SIZE"]
            image[r_start:r_stop, c_start:c_stop] = cell

    return image


# Ensure the image is square by adding a border if necessary.
# A 15x (e.g.) puzzle will be unchanged, a 15x16 (e.g.) will have black pixels
# added to the edges to make the final image square.
def center_puzzle(p):
    sh = p.shape
    if sh[0] == sh[1]:
        return p

    # Create a square image that will hold the puzzle
    dim = max(sh)
    sq = np.zeros((dim, dim, 3), dtype=np.uint8)

    # Insert the puzzle into the square image
    r_start = (dim - sh[0]) // 2
    r_stop = r_start + sh[0]
    c_start = (dim - sh[1]) // 2
    c_stop = c_start + sh[1]
    sq[r_start:r_stop, c_start:c_stop] = p

    return sq

if __name__ == "__main__":
    FILE_PATH = sys.argv[1]
    PUZ_FILE = "puz_files/other-puzzles/{}.puz".format(FILE_PATH)
    IMAGE_FILE = "puzzle_images/{}.png".format(FILE_PATH)
    PUZZLE = puz.read(PUZ_FILE)
    CIRCLED_SQUARES = PUZZLE.markup().get_markup_squares()

    # Assign sizes based on the puz file
    SIZES["ROWS"] = PUZZLE.height
    SIZES["COLS"] = PUZZLE.width
    SIZES["PUZZLE_HEIGHT"] = (
        (SIZES["BORDER"] * 2) + 
        (SIZES["CELL_SIZE"] * SIZES["ROWS"]) + 
        ((SIZES["ROWS"] - 1) * SIZES["GRID_LINE"]))
    SIZES["PUZZLE_WIDTH"] = (
        (SIZES["BORDER"] * 2) + 
        (SIZES["CELL_SIZE"] * SIZES["COLS"]) + 
        ((SIZES["COLS"] - 1) * SIZES["GRID_LINE"]))

    # Compute and save the image
    p = read_puzzle()
    raw = draw_puzzle(p)
    final = center_puzzle(raw)
    cv2.imwrite(IMAGE_FILE, final)