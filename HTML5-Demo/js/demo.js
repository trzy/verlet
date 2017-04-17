/*
 * demo.js
 * Bart Trzynadlowski
 * 2017.04.16
 *
 * Verlet integrator engine demo set up.
 */

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
    pt.AddForce(0, -9.8 * pt.mass);
    pt.AddConstraint(link);
    lastPt.AddConstraint(link);
    VerletAddObject(pt);
    segments.push(pt);
  }
  
  // Make last link heavy
  segments[segments.length - 1].mass = 1000;
  
  VerletAddObject(anchor);
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
  CreateRope(canvas.width / 2, canvas.height / 2, 300, 10);
  VerletStart(OnUpdateComplete);
}  