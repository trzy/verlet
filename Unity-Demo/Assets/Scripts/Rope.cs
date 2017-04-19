using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Rope: MonoBehaviour
{
  public float ropeLength = 1;
  public int numSegments = 10;
  public bool drawSkinnedMesh = true;
  private Verlet.System m_verlet;
  private List<Verlet.IBody> m_bodies;
  private GameObject m_lineObject;
  private LineRenderer m_line;
  private GameObject[] m_capsules;
  private SkinnedMeshRenderer m_mesh;

  private void Update()
  {
    m_verlet.Update(Time.deltaTime);
    for (int i = 0; i < m_bodies.Count; i++)
    {
      m_line.SetPosition(i, m_bodies[i].position);
    }

    if (drawSkinnedMesh)
    {
      /*
      for (int i = 0; i < m_bodies.Count; i ++)
      {
        int boneIdx = m_mesh.bones.Length - 1 - i;
        m_mesh.bones[boneIdx].position = m_bodies[i].position;
        if (boneIdx < m_mesh.bones.Length - 1)
        {
          Vector3 newUp = (m_mesh.bones[boneIdx + 1].position - m_mesh.bones[boneIdx].position).normalized;
          Quaternion rotation = m_mesh.bones[boneIdx].rotation;
          rotation.SetFromToRotation(m_mesh.bones[boneIdx + 1].right, newUp);
          m_mesh.bones[boneIdx].rotation = rotation;
        }
      }
      */
      for (int i = 0; i < m_bodies.Count; i++)
      {
        int boneIdx = m_mesh.bones.Length - 1 - i;
        m_mesh.bones[boneIdx].position = m_bodies[i].position;
        if (boneIdx < m_mesh.bones.Length - 1)
        {
          Vector3 newUp = (m_mesh.bones[boneIdx + 1].position - m_mesh.bones[boneIdx].position).normalized;
          Quaternion rotation = m_mesh.bones[boneIdx].rotation;
          rotation.SetFromToRotation(m_mesh.bones[boneIdx + 1].right, newUp);
          //m_mesh.bones[boneIdx].rotation = rotation;
        }
      }
      return;
    }

    for (int i = 0; i < m_bodies.Count - 1; i++)
    {
      m_capsules[i].transform.position = 0.5f * (m_bodies[i].position + m_bodies[i + 1].position);
      //m_capsules[i].transform.up = (m_bodies[i].position - m_bodies[i + 1].position).normalized;
      Quaternion rotation = m_capsules[i].transform.rotation;
      rotation.SetFromToRotation(Vector3.up, (m_bodies[i].position - m_bodies[i + 1].position).normalized);
      m_capsules[i].transform.rotation = rotation;
    }
  }

  private void CreateGeometry()
  {
    if (drawSkinnedMesh)
      return;
    float segmentLength = ropeLength / numSegments;
    m_capsules = new GameObject[m_bodies.Count - 1];
    for (int i = 0; i < m_bodies.Count - 1; i++)
    {
      m_capsules[i] = GameObject.CreatePrimitive(PrimitiveType.Capsule);
      m_capsules[i].transform.localScale = new Vector3(0.05f, 0.5f * segmentLength, 0.05f);
    }
  }

  private void Awake()
  {
    m_verlet = new Verlet.System();
    m_bodies = new List<Verlet.IBody>();
    m_mesh = GetComponentInChildren<SkinnedMeshRenderer>();    
    m_mesh.enabled = drawSkinnedMesh;

    // Construct rope with anchor assumed to be at pivot of this object
    Verlet.Anchor anchor = new Verlet.Anchor(transform);
    m_verlet.AddBody(anchor);
    m_bodies.Add(anchor);
    float segmentLength = ropeLength / numSegments;
    for (int i = 1; i < numSegments; i++)
    {
      Verlet.IBody point;
      if (i == numSegments - 1)
        point = new Verlet.Anchor(anchor.position + 0.25f * Vector3.right);
      else
        point = new Verlet.PointMass(transform.position - segmentLength * transform.up * i, 1);
      Verlet.IBody lastPoint = m_bodies[m_bodies.Count - 1];
      Verlet.IConstraint link = new Verlet.LinkConstraint(lastPoint, point, segmentLength, 1f);
      point.AddConstraint(link);
      point.AddForce(new Vector3(0, -9.8f * point.mass, 0));
      m_verlet.AddBody(point);
      m_bodies.Add(point);
    }

    // Debug line renderer
    m_lineObject = new GameObject("line");
    m_line = m_lineObject.AddComponent<LineRenderer>();
    m_line.startWidth = .01f;
    m_line.endWidth = .01f;
    m_line.startColor = Color.red;
    m_line.endColor = Color.red;
    m_line.positionCount = numSegments;

    // Geometry-based visualization
    CreateGeometry();
  }
}
