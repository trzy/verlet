/*
 * demo.js
 * Bart Trzynadlowski
 * 2017.04.20
 *
 * Verlet integrator engine demo set up.
 */
 
var g_gravity = 1200;

function CreateRope(x, y, length, numSegments)
{
  var anchor = new PointMass(x, y, 1);
  anchor.AddConstraint(new PinConstraint(anchor, x, y));
  
  var segments = [ anchor ];
  var segmentLength = length / numSegments;
  for (var i = 0; i < numSegments; i++)
  {
    var lastPt = segments[segments.length - 1];
    var pt = new PointMass(x + (i + 1) * segmentLength, y, 1);
    var link = new LinkConstraint(lastPt, pt, segmentLength, 1);
    pt.AddForce(0, -g_gravity * pt.mass);
    pt.AddConstraint(link);
    VerletAddObject(pt);
    segments.push(pt);
  }
  
  // Make last link heavy
  segments[segments.length - 1].mass = 10;
  
  VerletAddObject(anchor);
}

function CreateFabric(x, y, width, height, numSegmentsX, numSegmentsY)
{
  var stiffness = 1;
  var segmentWidth = width / numSegmentsX;
  var segmentHeight = height / numSegmentsY;
  var points = [];
  for (var i = 0; i < numSegmentsY; i++)
  {
    points[i] = [];
    for (var j = 0; j < numSegmentsX; j++)
    {
      var pt = new PointMass(x + j * segmentWidth, y - i * segmentHeight, 1);
      if (j > 0)
      {
        var leftPt = points[i][points[i].length - 1];
        var link = new LinkConstraint(leftPt, pt, segmentWidth, stiffness);
        pt.AddConstraint(link);
      }
      if (i == 0)
      {
        // Top row is pinned
        pt.AddConstraint(new PinConstraint(pt, pt.x, pt.y));
      }
      else
      {
        var topPt = points[i - 1][j];
        var link = new LinkConstraint(topPt, pt, segmentHeight, stiffness);
        pt.AddConstraint(link);
      }
      points[i].push(pt);
      VerletAddObject(pt);
    }
  }

  // Add gravity
  for (var i = 1; i < points.length; i++)
  {
    for (var j = 0; j < points[i].length; j++)
    {
      points[i][j].AddForce(0, -g_gravity * points[i][j].mass);
    }
  }
}

var g_highlightedObject;
var g_selectedObject;
var g_selectedPinConstraint;

function OnMouseMove(event)
{
  var canvas = document.getElementById("Viewport");
  var x = event.offsetX;
  var y = canvas.height - event.offsetY;
  g_highlightedObject = FindObjectAt(x, y);
  if (g_selectedObject)
  {
    g_selectedPinConstraint.x = x;
    g_selectedPinConstraint.y = y;
  }
}

function OnMouseDown(event)
{
  var canvas = document.getElementById("Viewport");
  var x = event.offsetX;
  var y = canvas.height - event.offsetY;
  g_selectedObject = FindObjectAt(x, y);
  if (g_selectedObject)
  {
    g_selectedPinConstraint = new PinConstraint(g_selectedObject, x, y);
    g_selectedObject.AddConstraint(g_selectedPinConstraint);
  }
}

function OnMouseUp(event)
{
  if (g_selectedObject)
  {
    g_selectedObject.RemoveConstraint(g_selectedPinConstraint);
    delete g_selectedPinConstraint;
  }
}

function OnUpdateComplete(ctx)
{
  if (g_highlightedObject)
  {
    ctx.beginPath();
    ctx.arc(g_highlightedObject.x, ctx.canvas.height - g_highlightedObject.y, 4, 0, 360);
    ctx.fillStyle = "#88f";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }
}

function Demo()
{
  $("#Viewport").mousemove(OnMouseMove);
  $("#Viewport").mousedown(OnMouseDown);
  $("#Viewport").mouseup(OnMouseUp);
  var canvas = document.getElementById("Viewport");
  CreateRope(canvas.width / 4, canvas.height * 0.74, 300, 30);
  CreateFabric(canvas.width / 2, canvas.height * 0.80, 500, 400, 30, 20);
  VerletStart(OnUpdateComplete);
}  