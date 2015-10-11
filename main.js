/********************************************************
 *  Bouncing ball
 *  Fix light position
*********************************************************/

var BACKGROUND = color(0, 0, 20);
var SHADE = color(0, 0, 0);
var GREY = color(100, 100, 100);
var BLUE = color(64, 95, 237);
var PINK = color(255, 0, 175);
var GREEN = color(28, 173, 123);
var ORANGE = color(255, 165, 0);

var MAX_NODES = 500;

var backgroundLight = 0;
var lightVector = { x: 0.5, y: -0.2, z: -2 };

var nodeSize = 10;
var persp = 1200;
var selected = false;

var translateX = width / 2;
var translateY = height / 2;

var toolbarWidth = 120;
var toolbarHeight = 0;
var toolbarX = width * 0.01;
var toolbarY = width * 0.01;

var showing = {
    'Control points': false,
    'Control arms': false,
    //'Average points': true,
    Edges: false,
    Fill: true,
    Grid: true,
};

/*******************************************
 * Camera set-up
********************************************/

// Defines the transformation matrix of seeing through the camera
var _camera = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// Return the position of an object at position (x, y)
// given the current camera
var applyCamera = function(x, y, z) {
    return [x * _camera[0][0] + y * _camera[1][0] + z * _camera[2][0],
            x * _camera[0][1] + y * _camera[1][1] + z * _camera[2][1],
            x * _camera[0][2] + y * _camera[1][2] + z * _camera[2][2]];
};

var applyPerspective = function(x, y, z) {
    var p = persp / (z + persp);
    return [x * p, y * p];
};

// Apply perspective and camera
var asSeen = function(x, y, z) {
    var x2 = x * _camera[0][0] + y * _camera[1][0] + z * _camera[2][0];
    var y2 = x * _camera[0][1] + y * _camera[1][1] + z * _camera[2][1];
    var z2 = x * _camera[0][2] + y * _camera[1][2] + z * _camera[2][2];
    
    var p = persp / (z2 + persp);
    return [x2 * p, y2 * p];
};

/********************************************************
 *      Linear algebra
*********************************************************/

var normaliseVector = function(v) {
    var d = sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return { x: v.x / d, y: v.y / d, z: v.z / d};
};

var subtractVectors = function(v1, v2){
    return {
        x: v1.x - v2.x,
        y: v1.y - v2.y,
        z: v1.z - v2.z
    };
};

// Given at least 3 nodes, find the normal to the plane they define
// Only the first 3 nodes are used.
var normalOfPlane = function(nodes) {
    var v1 = {
        x: nodes[0].px - nodes[1].px,
        y: nodes[0].py - nodes[1].py,
        z: nodes[0].z - nodes[1].z
    };
    var v2 = {
        x: nodes[0].px - nodes[2].px,
        y: nodes[0].py - nodes[2].py,
        z: nodes[0].z - nodes[2].z
    };
    
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
};

// Assume everything has 3 dimensions
var dotProduct = function(v1, v2){
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
};

/********************************************************
 *      Rotate functions
*********************************************************/

// Rotate shape around the z-axis
var rotateZ3D = function(theta) {
    var st = sin(theta);
    var ct = cos(theta);
    var x, y, z;
    
    for (var i = 0; i < 3; i++) {
        x = _camera[i][0];
        y = _camera[i][1];
        z = _camera[i][2];
        _camera[i] = [ct * x - st * y, ct * y + st * x, z];
    }
};

var rotateY3D = function(theta) {
    var ct = cos(theta);
    var st = sin(theta);
    var x, y, z;

    for (var i = 0; i < 3; i++) {
        x = _camera[i][0];
        y = _camera[i][1];
        z = _camera[i][2];
        _camera[i] = [ct * x + st * z, y, -st * x + ct * z];
    }
};

var rotateX3D = function(theta) {
    var ct = cos(theta);
    var st = sin(theta);
    var x, y, z;
    
    for (var i = 0; i < 3; i+=1) {
        x = _camera[i][0];
        y = _camera[i][1];
        z = _camera[i][2];
        _camera[i] = [x, ct * y - st * z, st * y + ct * z];
    }
};

var sortByZ = function(a, b) {
    //return b.getZ() - a.getZ();
    return b.z - a.z;
};

// Return "n1,n2", where n1 < n2
var getID = function(n1, n2) {
    if (n1 < n2) {
        return n1 + "," + n2;
    }
    return n2 + "," + n1;
};

/********************************************************
 *  GUI Button
*********************************************************/

var Button = function(x, y, w, h, name, clickFunction) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.name = name;
    this.defaultCol = color(220, 220, 220, 250);
    this.highlightCol = color(250, 50, 50, 250);
    this.showing = true;
    this.box = this.h - 6;
    this.clickFunction = clickFunction;
};

Button.prototype.mouseover = function() {
    var mx = mouseX;
    var my = mouseY;
    return (mx >= this.x && mx <= this.x + this.w &&
            my >= this.y && my <= this.y + this.h);
};

Button.prototype.click = function() {
    if (this.clickFunction) {
        this.clickFunction();
    }
};

Button.prototype.draw = function() {
    if (!this.showing) { return; }
    
    if (this.mouseover() || this.selected) {
        fill(this.defaultCol);
    } else {
        noFill();
    }
    strokeWeight(1);
    stroke(200);
    rect(this.x, this.y - 1, this.w, this.h + 3, 8);
    
    fill(10);
    textSize(15);
    textAlign(CENTER, CENTER);
    text(this.name, this.x + this.w / 2, this.y + this.h/2);
};

var CheckBox = function(x, y, w, h, name) {
    Button.call(this, x, y, w, h, name);
};
CheckBox.prototype = Object.create(Button.prototype);

CheckBox.prototype.click = function() {
    showing[this.name] = !showing[this.name];  
};

CheckBox.prototype.draw = function() {
    if (!this.showing) { return; }
    
    noStroke();
    if (this.mouseover() || this.selected) {
        fill(this.defaultCol);
    } else {
        noFill();
    }
    rect(this.x, this.y, this.w, this.h + 1, 5);
    
    fill(10);
    textSize(13);
    textAlign(LEFT, CENTER);
    text(this.name, this.x + this.box + 9, this.y + this.h/2);
    
    noFill();
    stroke(10);
    strokeWeight(1);
    rect(this.x + 4, this.y + 3, this.box, this.box);
    
    if (showing[this.name]) {
        line(this.x + 4, this.y + 3, this.x + this.box + 4, this.y + 3 + this.box);
        line(this.x + this.box + 5, this.y + 3, this.x + 5, this.y + 3 + this.box);
    }
};


/********************************************************
 *      Node object
 * A node is an point in 3D space
*********************************************************/

var Node = function(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.r = nodeSize;
    this.color = ORANGE;
    this.update();
};

Node.prototype.draw = function() {
    fill(this.color);
    noStroke();
    ellipse(this.px, this.py, this.r, this.r);
};

Node.prototype.update = function() {
    var coord = asSeen(this.x, this.y, this.z);
    this.px = coord[0];
    this.py = coord[1];
};

Node.prototype.getZ = function() {
    return this.z;
};

Node.prototype.info = function() {
    println(this.x  + " " + this.y + " " + this.z);
};

/********************************************************
 *      Edge object
 *  An edge is a line that join two nodes.
*********************************************************/

var Edge = function(node1, node2, color, thickness) {
    this.node1 = node1;
    this.node2 = node2;
    this.update();
    this.color = color || BLUE;
    this.thickness = thickness || 1;
};

Edge.prototype.draw = function() {
    stroke(this.color);
    strokeWeight(this.thickness);
    line(this.x1, this.y1, this.x2, this.y2);
};

Edge.prototype.update = function() {
    // var dx = this.node1.x - this.node2.x;
    // var dy = this.node1.y - this.node2.y;
    // var theta = atan2(dx, dy);

    this.x1 = this.node1.px;// - 0.5 * nodeSize * sin(theta);
    this.y1 = this.node1.py;// - 0.5 * nodeSize * cos(theta);
    this.x2 = this.node2.px;// + 0.5 * nodeSize * sin(theta);
    this.y2 = this.node2.py;// + 0.5 * nodeSize * cos(theta);
    
    this.z = 0.5 * (this.node1.z + this.node2.z) - this.thickness / 8;
};

Edge.prototype.getZ = function() {
    return 0.5 * (this.node1.z + this.node2.z) - this.thickness / 10;
};

/********************************************************
 *      Face object
 * A face is a surface that joins an array of nodes.
 * Its colour depends on its orientation relative to
 * a light source.
*********************************************************/

var Face = function(nodes, color) {
    this.nodes = nodes;
    this.update();
    this.color = color || GREEN;
    this.light = this.color;
    this.sort = 0;
    
    if (this.nodes.length === 3) {
        this.drawShape = this.drawTriangle;
    } else {
        this.drawShape = this.drawQuad;
    }
};

Face.prototype.update = function() {
    var normal = normaliseVector(normalOfPlane(this.nodes));
    var l = 1 - constrain(dotProduct(lightVector, normal), 0, 1);
    this.light = lerpColor(this.color, SHADE, l);
    
    // Find order in which to draw faces
    // by finding where it intersects the z-axis
    
    if (normal.z < 0) {
        //this.z = dotProduct(normal, this.nodes[0]) / normal.z;
        
        this.z = 0;
        var n = this.nodes.length;
        for (var i = 0; i < n; i++) {
            this.z += this.nodes[i].z;
        }
        this.z /= n;
    } else {
        this.z = null;
    }
    
};

Face.prototype.info = function() {
    println("Face (" + this.nodes.length + ")");
    for (var i = 0; i < this.nodes.length; i++) {
        this.nodes[i].info();
    }
};

Face.prototype.draw = function() {
    strokeWeight(1);
    fill(this.light);
    stroke(this.light);
    this.drawShape();
};

Face.prototype.drawTriangle = function() {
    triangle(this.nodes[0].px, this.nodes[0].py,
             this.nodes[1].px, this.nodes[1].py,
             this.nodes[2].px, this.nodes[2].py);
};

Face.prototype.drawQuad = function() {
    quad(this.nodes[0].px, this.nodes[0].py,
         this.nodes[1].px, this.nodes[1].py,
         this.nodes[2].px, this.nodes[2].py,
         this.nodes[3].px, this.nodes[3].py);
};

/********************************************************
 *      Average Point object
 * A point whose position is defined as the weighted
 * average of a list of points.
*********************************************************/

var AveragePoint = function(points, weights, n) {
    this.color = GREEN;
    this.points = points;
    this.weights = weights;
    this.r = 8;
    this.n = n; // Index in node array
    
    this.update();
};

AveragePoint.prototype.draw = function() {
    strokeWeight(1);
    stroke(BACKGROUND);
    fill(this.color);
    ellipse(this.px, this.py, this.r, this.r);
};

AveragePoint.prototype.update = function() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    
    for (var i in this.weights) {
        var w = this.weights[i];
        var p = this.points[i];
        this.x += p.x * w;
        this.y += p.y * w;
        this.z += p.z * w;
    }
    
    var coord = asSeen(this.x, this.y, this.z);
    this.px = coord[0];
    this.py = coord[1];
};

AveragePoint.prototype.getZ = function() {
    // Ensure these are drawn behind the main nodes
    return this.z + 0.01;
};

AveragePoint.prototype.info = function() {
    println("Point (" + this.x + ", " + this.y +  ", " + this.z + ")");
    for (var i in this.weights) {
        println(this.weights[i] + " * node " + i + " (" + this.points[i].x + ", " + this.points[i].y + ")");
    }
};

// Given an array of AveragePoints, return a hash
// of their weight averaged
var getAverageOfWeights = function(points) {
    var d = { };
    var w = 1 / points.length;
    
    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        for (var j in p.weights) {
            if (d[j]) {
                d[j] += p.weights[j] * w;
            } else {
                d[j] = p.weights[j] * w;  
            }
        }   
    }
    
    return d;
};

// Given an array of AveragePoints,
// return a new averagePoint, which is their average
var getAverageOfPoints = function(points, n) {
    var d = getAverageOfWeights(points);

    return new AveragePoint(points[0].points, d, n);
};

/********************************************************
 *      Wireframe object
*********************************************************/

var Wireframe = function(shape) {
    this.originalNodes = shape.nodes;
    this.originalFaces = shape.faces;
    this.selectedNode = false;
    this.reset();
};

Wireframe.prototype.reset = function() {
    // Create Wireframe control points
    this.nodes = [];
    
    for (var i = 0; i < this.originalNodes.length; i++) {
        var n = this.originalNodes[i];
        this.nodes.push(new Node(n[0], n[1], n[2]));
    }
    
    this.undivide();
};

// Get shape in its undivided form
Wireframe.prototype.undivide = function() {
    // Add average points at each node
    this.averageNodes = [];
    for (var i = 0; i < this.nodes.length; i++) {
        var d = {};
        d[i] = 1;
        this.averageNodes.push(new AveragePoint(this.nodes, d, i));
    }

    this.faceNums = this.originalFaces;
    this.createFaces();

    this.edges = [];
    this.averageEdges = [];
    
    // Keep track of which edges we have created
    var edgeIDs = [];
    
    for (var i = 0; i < this.originalFaces.length; i++) {
        var face = this.originalFaces[i];
        var n = face.length;
        
        for (var j = 0; j < n; j++) {
            var n1 = face[j];
            var n2 = face[(j + 1) % n];
            var id = getID(n1, n2);
            
            if (edgeIDs.indexOf(id) === -1) {
                this.edges.push(
                    new Edge(this.nodes[n1], this.nodes[n2])
                );
                this.averageEdges.push(
                    new Edge(this.averageNodes[n1],
                             this.averageNodes[n2], GREEN, 2)
                );
                edgeIDs.push(id);
            }
            
        }
    }

    this.collectParts();    
};

// Convert an array of arrays of node indices into an
// array of face objects from those nodes
Wireframe.prototype.createFaces = function() {
    this.faces = [];
    for (var i = 0; i < this.faceNums.length; i++) {
        var nodeNums = this.faceNums[i];
        var nodes = [];
        for (var j = 0; j < nodeNums.length; j++) {
            nodes.push(this.averageNodes[nodeNums[j]]);
        }
        this.faces.push(new Face(nodes));
        
    }
};

// Collect everything together so we can sort and draw
Wireframe.prototype.collectParts = function() {
    this.parts = [];
    
    if (showing['Control points']) {
        this.parts = this.parts.concat(this.nodes);
    }
    if (showing['Control arms']) {
        this.parts = this.parts.concat(this.edges);
    }
    if (showing['Average points']) {
        this.parts = this.parts.concat(this.averageNodes);
    }
    if (showing.Fill) {
        this.parts = this.parts.concat(this.faces);
    }
    if (showing.Edges) {
        this.parts = this.parts.concat(this.averageEdges);
    }
    this.parts.sort(sortByZ);
    this.update();
};

Wireframe.prototype.draw = function() {
    for (var i = 0; i < this.parts.length; i++) {
        if (this.parts[i].z !== null) {
            this.parts[i].draw();   
        }
    }
};

Wireframe.prototype.update = function() {
    for (var i = 0; i < this.nodes.length; i++) {
        this.nodes[i].update();
    }

    for (var i = 0; i < this.edges.length; i++) {
        this.edges[i].update();
    }
    
    for (var i = 0; i < this.averageNodes.length; i++) {
        this.averageNodes[i].update();
    }
    
    for (var i = 0; i < this.averageEdges.length; i++) {
        this.averageEdges[i].update();
    }
    
    for (var i = 0; i < this.faces.length; i++) {
        this.faces[i].update();
    }
    
    this.parts.sort(sortByZ);
};

// Create new average points along each face and each edge
Wireframe.prototype.split = function() {
    var n = this.averageNodes.length;
    
    // Add nodes halfway along each edge
    var newEdges = [];
    var nodeOfEdge = {};
    
    for (var i = 0; i < this.averageEdges.length; i++) {
        var node1 = this.averageEdges[i].node1;
        var node2 = this.averageEdges[i].node2;
        var newNode = getAverageOfPoints([node1, node2], n + i);
        
        this.averageNodes.push(newNode);
        newEdges.push(new Edge(node1, newNode, GREEN, 2));
        newEdges.push(new Edge(node2, newNode, GREEN, 2));
        
        // Record which two nodes this new node is between
        // nodeOfEdge['2,4'] = node
        // means this node is between node 2 and 4
        nodeOfEdge[getID(node1.n, node2.n)] = newNode;
    }
    
    n = this.averageNodes.length;
    
    // Add new nodes in the center of each face
    var newFaces = [];
    for (var i = 0; i < this.faceNums.length; i++) {
        var face = this.faceNums[i];
        var nodeInFace = face.length;
        
        // Get the nodes on the midpoint of each edge
        var edgeNodes = [];
        for (var j = 0; j < nodeInFace; j++) {
            var id = getID(face[j], face[(j + 1) % nodeInFace]);
            edgeNodes.push(nodeOfEdge[id]);
        }
        
        // Create new node, which is the average of the midpoints
        var centerNode = getAverageOfPoints(edgeNodes, n + i);
        this.averageNodes.push(centerNode);
        
        // Create four new edges
        for (var j = 0; j < edgeNodes.length; j++) {
            newEdges.push(new Edge(centerNode, edgeNodes[j], GREEN, 2));
        }
        
        // Create four new faces
        for (var j = 0; j < nodeInFace; j++) {
            var n1 = face[j];
            var n2 = edgeNodes[j].n;
            var n3 = edgeNodes[(j + nodeInFace - 1) % nodeInFace].n;
            newFaces.push([n1, n2, n + i, n3]);
        }
    }

    this.averageEdges = newEdges;
    this.faceNums = newFaces;
    this.createFaces();
    this.collectParts();
    this.update();
};

// Each point becomes an average of its neighbours
Wireframe.prototype.average = function() {
    var n = this.averageNodes.length;
    
    // Create an array for each node
    var edgesOfNode = [];
    for (var i = 0; i < n; i++) {
        edgesOfNode.push([]);
    }
    
    // Go through each each edge add pairs of nodes
    for (var i = 0; i < this.averageEdges.length; i++) {
        var n1 = this.averageEdges[i].node1;
        var n2 = this.averageEdges[i].node2;
        edgesOfNode[n1.n].push(n2);
        edgesOfNode[n2.n].push(n1);
    }
    
    // Each node is averaged with itself and its neighbours
    var newWeights = [];
    for (var i = 0; i < n; i++) {
        newWeights.push(getAverageOfWeights(edgesOfNode[i]));
    }
    
    for (var i = 0; i < n; i++) {
        this.averageNodes[i].weights = newWeights[i];
    }
        
    this.collectParts();
    this.update();
};

Wireframe.prototype.move = function() {
    this.nodes[0].y = -120 + sin(frameCount * 10) * 20;
    this.nodes[1].y = -120 + sin(frameCount * 10) * 20;
    this.nodes[4].y = -120 + sin(frameCount * 10) * 20;
    this.nodes[5].y = -120 + sin(frameCount * 10) * 20;
    
    this.update();
};

Wireframe.prototype.mousePressed = function() {
    var mx = mouseX - translateX;
    var my = mouseY - translateY;
    
    if (showing['Control points']) {
        for (var n = 0; n < this.nodes.length; n++) {
            var node = this.nodes[n];
            if (dist(mx, my, node.px, node.py) <= nodeSize * 0.5) {
                this.selectedNode = node;
                break;
            }
        }   
    }
};

Wireframe.prototype.mouseDragged = function() {
    var dx = mouseX - pmouseX;
    var dy = mouseY - pmouseY;
    
    if (this.selectedNode !== false) {
        this.selectedNode.x += dx;
        this.selectedNode.y += dy;
        this.update();
        return false;
    } else {
        rotateY3D(dx, this.nodes);
        rotateX3D(dy, this.nodes);
    }
    
    this.update();
    return true;
};

Wireframe.prototype.mouseReleased = function() {
    this.selectedNode = false;
};

/********************************************************
 *      Grid objects
 * a grid in the xz plane with n squares in each direction
 * size is the size of each square
*********************************************************/

var Grid = function(n, size, y) {
    this.n = n;
    this.size = size;
    this.y = y || 0;
    this.reset();
};

Grid.prototype.reset = function() {
    this.nodes = [];
    this.edges = [];
    
   for (var i = 0; i <= this.n; i++) {
        var x = (i - this.n / 2) * this.size;
        for (var j = 0; j <= this.n; j++) {
            var z = (j - this.n / 2) * this.size;
            this.nodes.push({ x: x, y: this.y, z: z});
            
            var p = j * (this.n + 1) + i;
            if (i > 0) {
                this.edges.push([p, p - 1]);
            }
            if (j > 0) {
                this.edges.push([p, p - this.n - 1]);
            }
        }
    }
    
    this.corners = [
        this.nodes[0],
        this.nodes[this.n],
        this.nodes[(this.n + 1) * (this.n + 1) - 1],
        this.nodes[(this.n + 1) * this.n]
    ];
};

Grid.prototype.draw = function() {
    noStroke();
    fill(0, 0, 255, 40);
    
    var corners = [];
    for (var i = 0; i < 4; i++) {
        corners.push(asSeen(this.corners[i].x, this.corners[i].y, this.corners[i].z));
    }
    
    quad(corners[0][0], corners[0][1],
         corners[1][0], corners[1][1],
         corners[2][0], corners[2][1],
         corners[3][0], corners[3][1]);
    
    strokeWeight(1);
    stroke(80, 80, 40, 60);
    
    for (var i = 0; i < this.edges.length; i++) {
        var edge = this.edges[i];
        
        var node = this.nodes[edge[0]];
        var coord = asSeen(node.x, node.y, node.z);
        var px1 = coord[0];
        var py1 = coord[1];
        
        node = this.nodes[edge[1]];
        coord = asSeen(node.x, node.y, node.z);
        var px2 = coord[0];
        var py2 = coord[1];
        
        line(px1, py1, px2, py2);   
    }
};

Grid.prototype.orientation = function() {
    for (var i = 0; i < this.corners.length; i++) {
        var coord = asSeen(this.corners[i].x, this.corners[i].y, this.corners[i].z);
        this.corners[i].px = coord[0];
        this.corners[i].py = coord[1];
    }
    
    return normalOfPlane(this.corners);
};

Grid.prototype.mouseDragged = function() {
    var dx = mouseX - pmouseX;
    var dy = mouseY - pmouseY;
    rotateY3D(dx, this.nodes);
    rotateX3D(dy, this.nodes);
};

/********************************************************
 *      Create wireframe objects
*********************************************************/

var createCuboid = function(x, y, z, w, h, d) {
    var nodes = [
        [x, y, z],
        [x, y, z + d],
        [x, y + h, z],
        [x, y + h, z + d],
        [x + w, y, z],
        [x + w, y, z + d],
        [x + w, y + h, z],
        [x + w, y + h, z + d]
    ];

    var faces= [
        [0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1],
        [0, 2, 6, 4], [1, 5, 7, 3], [2, 3, 7, 6]
    ];

    return { 'nodes': nodes, 'faces': faces };
};

var createSquareTorus = function(x, y, z, d, r) {
    var d2 = d / 2;
    var r2 = r / 2;
    
    var nodes = [
        [x - r2 - d, y - r2 - d, z - d2],
        [x - r2,     y - r2 - d, z - d2],
        [x + r2,     y - r2 - d, z - d2],
        [x + r2 + d, y - r2 - d, z - d2],
        [x - r2 - d, y - r2,     z - d2],
        [x - r2,     y - r2,     z - d2],
        [x + r2,     y - r2,     z - d2],
        [x + r2 + d, y - r2,     z - d2],
        [x - r2 - d, y + r2,     z - d2],
        [x - r2,     y + r2,     z - d2],
        [x + r2,     y + r2,     z - d2],
        [x + r2 + d, y + r2,     z - d2],
        [x - r2 - d, y + r2 + d, z - d2],
        [x - r2,     y + r2 + d, z - d2],
        [x + r2,     y + r2 + d, z - d2],
        [x + r2 + d, y + r2 + d, z - d2],
        
        [x - r2 - d, y - r2 - d, z + d2],
        [x - r2,     y - r2 - d, z + d2],
        [x + r2,     y - r2 - d, z + d2],
        [x + r2 + d, y - r2 - d, z + d2],
        [x - r2 - d, y - r2,     z + d2],
        [x - r2,     y - r2,     z + d2],
        [x + r2,     y - r2,     z + d2],
        [x + r2 + d, y - r2,     z + d2],
        [x - r2 - d, y + r2,     z + d2],
        [x - r2,     y + r2,     z + d2],
        [x + r2,     y + r2,     z + d2],
        [x + r2 + d, y + r2,     z + d2],
        [x - r2 - d, y + r2 + d, z + d2],
        [x - r2,     y + r2 + d, z + d2],
        [x + r2,     y + r2 + d, z + d2],
        [x + r2 + d, y + r2 + d, z + d2],
    ];
    
    var faces= [
        // Top faces top
        [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6],
        // Top faces sides
        [4, 5, 9, 8], [6, 7, 11, 10],
        // Top faces bottom
        [8, 9, 13, 12], [9, 10, 14, 13], [10, 11, 15, 14],
        // Lower faces
        [16, 17, 21, 20], [17, 18, 22, 21], [18, 19, 23, 22],
        // Lower faces sides
        [20, 21, 25, 24], [22, 23, 27, 26],
        // Lower faces bottom
        [24, 25, 29, 28], [25, 26, 30, 29], [26, 27, 31, 30],
    ];
    
    // Create edge faces
    // List of nodes around outer edge
    var edges = [0, 1, 2, 3, 7, 11, 15, 14, 13, 12, 8, 4];
    
    for (var i = 0; i < edges.length; i++) {
        var n1 = edges[i];
        var n2 = edges[(i + 1) % edges.length];
        faces.push([n1, n2, n2 + 16, n1 + 16]);
    }
    
    // Inner faces
    edges = [5, 6, 10, 9];
    for (var i = 0; i < edges.length; i++) {
        var n1 = edges[i];
        var n2 = edges[(i + 1) % edges.length];
        faces.push([n1, n2, n2 + 16, n1 + 16]);
    }

    return { 'nodes': nodes, 'faces': faces };
};

var createSquareTorus2 = function(x, y, z, d, r) {
    var d2 = d / 2;
    var r2 = r / 2;
    
    var nodes = [
        [x - r2,     y - r2 - d, z - d2],
        [x + r2,     y - r2 - d, z - d2],
        [x - r2 - d, y - r2,     z - d2],
        [x - r2,     y - r2,     z - d2],
        [x + r2,     y - r2,     z - d2],
        [x + r2 + d, y - r2,     z - d2],
        [x - r2 - d, y + r2,     z - d2],
        [x - r2,     y + r2,     z - d2],
        [x + r2,     y + r2,     z - d2],
        [x + r2 + d, y + r2,     z - d2],
        [x - r2,     y + r2 + d, z - d2],
        [x + r2,     y + r2 + d, z - d2],
        
        [x - r2,     y - r2 - d, z + d2],
        [x + r2,     y - r2 - d, z + d2],
        [x - r2 - d, y - r2,     z + d2],
        [x - r2,     y - r2,     z + d2],
        [x + r2,     y - r2,     z + d2],
        [x + r2 + d, y - r2,     z + d2],
        [x - r2 - d, y + r2,     z + d2],
        [x - r2,     y + r2,     z + d2],
        [x + r2,     y + r2,     z + d2],
        [x + r2 + d, y + r2,     z + d2],
        [x - r2,     y + r2 + d, z + d2],
        [x + r2,     y + r2 + d, z + d2]
    ];
    
    var faces= [
        // Top faces top
        [0, 2, 3], [0, 3, 4, 1], [1, 4, 5],
        // Top faces sides
        [2, 6, 7, 3], [4, 8, 9, 5],
        // Top faces bottom
        [6, 10, 7], [7, 10, 11, 8], [8, 11, 9],
        // Lower faces top
        [12, 15, 14], [12, 13, 16, 15], [13, 17, 16],
        // Lower faces sides
        [14, 15, 19, 18], [16, 17, 21, 20],
        // Lower faces bottom
        [18, 19, 22], [19, 20, 23, 22], [20, 21, 23],
    ];
    
    // Create edge faces
    // List of nodes around outer edge
    var edges = [0, 1, 5, 9, 11, 10, 6, 2];
    for (var i = 0; i < edges.length; i++) {
        var n1 = edges[i];
        var n2 = edges[(i + 1) % edges.length];
        faces.push([n1, n2, n2 + 12, n1 + 12]);
    }
    
    // Inner faces
    edges = [3, 7, 8, 4];
    for (var i = 0; i < edges.length; i++) {
        var n1 = edges[i];
        var n2 = edges[(i + 1) % edges.length];
        faces.push([n1, n2, n2 + 12, n1 + 12]);
    }

    return { 'nodes': nodes, 'faces': faces };
};

var wirefame = createCuboid(-120, -120, -100, 240, 240, 240);
var myShape = new Wireframe(wirefame);
var grid = new Grid(20, 80, 100);

for (var i = 0; i < 3; i++) {
    myShape.split();
    myShape.average();
}

var lightVector = normaliseVector(lightVector);

/********************************************************
 *      GUI
*********************************************************/

var createButtons = function() {
    var buttons = [];
    var x = toolbarX + 8;
    var y = toolbarY + 6;
    var w = 102;
    var h = 15;

    // Functions to attach to buttons
    var funcs = {
        "Split": function() {
            if (myShape.averageNodes.length < MAX_NODES) {
                myShape.split();
            }
        },
        "Average": function() {
            myShape.average();
        },
        "Subdivide": function() {
            if (myShape.averageNodes.length < MAX_NODES) {
                myShape.split();
                myShape.average();   
            }
        },
        "Undivide": function() {
            myShape.undivide();
        },
        "Reset": function() {
            myShape.reset();
            grid.reset();
        }
    };

    for (var f in funcs) {
        buttons.push(new Button(x, y, w, h, f, funcs[f]));
        y += 25;    
    }    
    
    for (var opt in showing) {
        buttons.push(new CheckBox(x, y, w, h, opt));
        y += 20;
    }
    
    toolbarHeight = y - 5;
    
    return buttons;
};

var buttons = createButtons();

var drawGUI = function() {
    noStroke();
    fill(240, 240, 240, 200);
    rect(toolbarX, toolbarY, toolbarWidth, toolbarHeight, 8);
    
    fill(10);
    textAlign(LEFT, CENTER);
   
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].draw();
    }
};

/***************************************************
 *      Main loop
****************************************************/

var draw = function() {
    background(BACKGROUND);

    pushMatrix();
    translate(translateX, translateY);
    
    if (showing.Grid && grid.orientation().z > 0) {
        grid.draw();   
    }
    
    myShape.draw();
    
    if (showing.Grid && grid.orientation().z <= 0) {
        grid.draw();   
    }
    
    popMatrix();
    
    myShape.move();
};

/********************************************************
 *      Event handling
*********************************************************/

mousePressed = function() {
    myShape.mousePressed();
    for (var b = 0; b < buttons.length; b++) {
        if (buttons[b].mouseover()) {
            buttons[b].selected = true;
        }
    }
};

mouseDragged = function() {
    if (myShape.mouseDragged()) {
        grid.mouseDragged();   
    }
};

mouseReleased = function() {
    myShape.mouseReleased();
    
    selected = false;
    for (var b = 0; b < buttons.length; b++) {
        if (buttons[b].mouseover() && buttons[b].selected) {
            buttons[b].click();
            myShape.collectParts();
        }
        buttons[b].selected = false;
    }
};

mouseOut = function() {
    mouseReleased();
};

keyPressed = function() {
    if (keyCode === LEFT) {
        rotateY3D(-3);
    } else if (keyCode === RIGHT) {
        rotateY3D(3);
    } else if (keyCode === UP) {
        rotateX3D(3);
    } else if (keyCode === DOWN) {
        rotateX3D(-3);
    }
    myShape.update();
};

rotateY3D(30);
rotateX3D(15);
myShape.update();
